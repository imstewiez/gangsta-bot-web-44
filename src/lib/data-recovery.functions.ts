// Data recovery & diagnostics — superadmin only.
// These functions help rebuild derived tables when data is lost or inconsistent.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { assertSuperAdmin } from "./admin.functions";

const ADVISORY_LOCK_KEY = 424242;
const MAX_RUNTIME_MS = 25000;
const RECALC_WEEKS = 4;

export async function doRecalcWeeklyRankings(): Promise<{
  rows_updated: number;
  weeks_processed: number;
  job_run_id: number | null;
  aborted?: boolean;
}> {
  const startTime = Date.now();

  // Acquire advisory lock to prevent concurrent runs
  const lockResult = await pgOne<{ pg_try_advisory_lock: boolean }>(
    `SELECT pg_try_advisory_lock(${ADVISORY_LOCK_KEY})`,
  );
  if (!lockResult?.pg_try_advisory_lock) {
    throw new Error("Another recalc job is already running (advisory lock in use)");
  }

  let jobRunId: number | null = null;

  try {
    // Record job start
    const jobRow = await pgOne<{ id: number }>(
      `INSERT INTO job_runs (job_name, started_at, status)
       VALUES ('recalc_weekly_rankings', now(), 'running')
       RETURNING id`,
    );
    jobRunId = jobRow?.id ?? null;

    // Close stale operations as part of daily maintenance (moved from listSaidas)
    await pgQuery(
      `UPDATE operations
       SET status = 'concluida',
           end_time = coalesce(end_time, now()),
           updated_at = now()
       WHERE deleted_at IS NULL
         AND status IN ('criada','trancagem','em_preparacao','em_curso','em_liquidacao')
         AND coalesce(start_time, date::timestamp, created_at) < now() - interval '12 hours'`,
    );

    // Calculate cutoff date: only last N weeks
    const cutoffRes = await pgOne<{ cutoff: string }>(
      `SELECT (date_trunc('week', current_date) - interval '${RECALC_WEEKS - 1} weeks')::date::text as cutoff`,
    );
    const cutoff = cutoffRes?.cutoff ?? '2026-04-20';

    // Clear only recent weeks (not everything since 2026-04-20)
    await pgQuery(
      `DELETE FROM weekly_rankings WHERE week_start >= $1::date`,
      [cutoff],
    );

    const weekRows = await pgQuery<{ ws: string }>(
      `SELECT distinct date_trunc('week', d)::date::text as ws
       FROM generate_series($1::date, current_date, '1 day'::interval) d
       ORDER BY 1`,
      [cutoff],
    );

    let weeksProcessed = 0;

    for (const row of weekRows) {
      // Deadline checking: abort gracefully if nearing Worker timeout
      if (Date.now() - startTime > MAX_RUNTIME_MS) {
        await pgQuery(
          `UPDATE job_runs SET status = 'aborted', ended_at = now(), error_message = $1 WHERE id = $2`,
          ['Deadline exceeded: aborted to avoid Worker timeout', jobRunId],
        );
        return { rows_updated: 0, weeks_processed: weeksProcessed, job_run_id: jobRunId, aborted: true };
      }

      const ws = row.ws;
      await pgQuery(
        `INSERT INTO weekly_rankings (
          member_id, week_start, week_end, deliveries, sales, operations_count,
          weighted_value, return_rate, rank_position, kills_count, wins_count, loss_count,
          net_profit_generated, survival_rate, performance_score, hybrid_score, normalized_score, total_score, created_at
        )
        WITH bounds AS (SELECT $1::date AS ws, ($1::date + interval '6 days')::date AS we),
        kills AS (
          SELECT killer_id AS member_id, COUNT(*)::int AS kills_count
          FROM kill_logs, bounds
          WHERE date BETWEEN bounds.ws AND bounds.we AND killer_id IS NOT NULL
          GROUP BY killer_id
        ),
        ops AS (
          SELECT p.member_id,
                 COUNT(*)::int AS operations_count,
                 COUNT(*) FILTER (WHERE o.was_profitable = true)::int AS wins_count,
                 COUNT(*) FILTER (WHERE o.was_profitable = false OR o.was_profitable IS NULL)::int AS loss_count,
                 COUNT(*) FILTER (WHERE p.died)::int AS deaths_in_ops,
                 COUNT(*) FILTER (WHERE p.survived)::int AS survived_in_ops,
                 COALESCE(SUM(p.net_material_delta), 0)::numeric AS net_profit_generated
          FROM operation_participants p
          JOIN operations o ON o.id = p.operation_id AND o.deleted_at IS NULL
          CROSS JOIN bounds
          WHERE COALESCE(o.end_time, o.start_time, o.date::timestamp) BETWEEN bounds.ws AND bounds.we + interval '1 day'
            AND o.status = 'concluida'
          GROUP BY p.member_id
        ),
        inv AS (
          SELECT member_id, COUNT(*)::int AS deliveries
          FROM inventory_movements, bounds
          WHERE created_at BETWEEN bounds.ws AND bounds.we + interval '1 day'
            AND movement_type IN ('entrega_bairrista', 'entrega_oficial')
            AND member_id IS NOT NULL
          GROUP BY member_id
        ),
        sales AS (
          SELECT member_id, COUNT(*)::int AS sales
          FROM inventory_movements, bounds
          WHERE created_at BETWEEN bounds.ws AND bounds.we + interval '1 day'
            AND movement_type = 'venda_bairrista'
            AND member_id IS NOT NULL
          GROUP BY member_id
        ),
        weighted AS (
          SELECT member_id, SUM(quantity)::int AS weighted_value
          FROM inventory_movements, bounds
          WHERE created_at BETWEEN bounds.ws AND bounds.we + interval '1 day'
            AND movement_type IN ('entrega_bairrista', 'venda_bairrista', 'entrega_oficial')
            AND member_id IS NOT NULL
          GROUP BY member_id
        ),
        return_rates AS (
          SELECT p.member_id, COALESCE(AVG(p.discipline_score), 0)::numeric AS return_rate
          FROM operation_participants p
          JOIN operations o ON o.id = p.operation_id AND o.deleted_at IS NULL
          CROSS JOIN bounds
          WHERE COALESCE(o.end_time, o.start_time, o.date::timestamp) BETWEEN bounds.ws AND bounds.we + interval '1 day'
            AND o.status = 'concluida'
          GROUP BY p.member_id
        ),
        computed AS (
          SELECT m.id AS member_id,
                 COALESCE(k.kills_count, 0) AS kills_count,
                 COALESCE(o.operations_count, 0) AS operations_count,
                 COALESCE(o.wins_count, 0) AS wins_count,
                 COALESCE(o.loss_count, 0) AS loss_count,
                 COALESCE(o.deaths_in_ops, 0) AS deaths_in_ops,
                 COALESCE(o.survived_in_ops, 0) AS survived_in_ops,
                 COALESCE(o.net_profit_generated, 0) AS net_profit_generated,
                 COALESCE(d.deliveries, 0) AS deliveries,
                 COALESCE(s.sales, 0) AS sales,
                 COALESCE(w.weighted_value, 0) AS weighted_value,
                 COALESCE(r.return_rate, 0) AS return_rate,
                 CASE WHEN COALESCE(o.operations_count, 0) > 0
                      THEN COALESCE(o.survived_in_ops, 0)::numeric / COALESCE(o.operations_count, 1)
                      ELSE 0
                 END AS survival_rate,
                 COALESCE(k.kills_count, 0) * 10 + COALESCE(o.wins_count, 0) * 20 - COALESCE(o.loss_count, 0) * 5 + COALESCE(o.net_profit_generated, 0) / 100 + COALESCE(o.operations_count, 0) * 3 AS performance_score,
                 COALESCE(w.weighted_value, 0) * 0.4 +
                 (COALESCE(k.kills_count, 0) * 10 + COALESCE(o.wins_count, 0) * 20 - COALESCE(o.loss_count, 0) * 5 + COALESCE(o.net_profit_generated, 0) / 100 + COALESCE(o.operations_count, 0) * 3) * 0.4 +
                 (COALESCE(r.return_rate, 0) * 0.5 + CASE WHEN COALESCE(o.operations_count, 0) > 0 THEN (COALESCE(o.survived_in_ops, 0)::numeric / COALESCE(o.operations_count, 1)) * 0.3 ELSE 0 END) * 0.2 AS hybrid_score
          FROM members m
          LEFT JOIN kills k ON k.member_id = m.id
          LEFT JOIN ops o ON o.member_id = m.id
          LEFT JOIN inv d ON d.member_id = m.id
          LEFT JOIN sales s ON s.member_id = m.id
          LEFT JOIN weighted w ON w.member_id = m.id
          LEFT JOIN return_rates r ON r.member_id = m.id
          WHERE m.deleted_at IS NULL
            AND m.role = 'bairrista'
            AND (m.status = 'ativo' OR m.status IS NULL AND COALESCE(m.lifecycle_state::text, 'active') IN ('active', 'promoted'))
            AND (COALESCE(k.kills_count, 0) + COALESCE(o.operations_count, 0) + COALESCE(d.deliveries, 0) + COALESCE(s.sales, 0) > 0)
        ),
        ranked AS (
          SELECT *,
                 ROW_NUMBER() OVER (ORDER BY hybrid_score DESC) AS rank_position,
                 MAX(hybrid_score) OVER () AS max_score
          FROM computed
        )
        SELECT member_id, bounds.ws, bounds.we, deliveries, sales, operations_count,
               weighted_value, return_rate, rank_position,
               kills_count, wins_count, loss_count,
               net_profit_generated, survival_rate, performance_score, hybrid_score,
               CASE WHEN max_score > 0 THEN hybrid_score / max_score ELSE 0 END,
               ROUND(hybrid_score)::int,
               now()
        FROM ranked, bounds
        ORDER BY hybrid_score DESC
        ON CONFLICT (member_id, week_start) DO UPDATE SET
          week_end = EXCLUDED.week_end,
          deliveries = EXCLUDED.deliveries,
          sales = EXCLUDED.sales,
          operations_count = EXCLUDED.operations_count,
          weighted_value = EXCLUDED.weighted_value,
          return_rate = EXCLUDED.return_rate,
          rank_position = EXCLUDED.rank_position,
          kills_count = EXCLUDED.kills_count,
          wins_count = EXCLUDED.wins_count,
          loss_count = EXCLUDED.loss_count,
          net_profit_generated = EXCLUDED.net_profit_generated,
          survival_rate = EXCLUDED.survival_rate,
          performance_score = EXCLUDED.performance_score,
          hybrid_score = EXCLUDED.hybrid_score,
          normalized_score = EXCLUDED.normalized_score,
          total_score = EXCLUDED.total_score,
          created_at = now()`,
        [ws],
      );
      weeksProcessed++;
    }

    const r = await pgOne<{ count: number }>(`SELECT count(*)::int as count FROM weekly_rankings`);

    // Auto-generate prize for the most recent week if not already exists
    const top = await pgOne<{
      member_id: number;
      week_start: string;
      week_end: string;
      score: number | null;
    }>(
      `SELECT wr.member_id, wr.week_start, wr.week_end,
              coalesce(wr.hybrid_score, wr.normalized_score, wr.performance_score)::float as score
       FROM weekly_rankings wr
       WHERE wr.week_start = (SELECT max(week_start) FROM weekly_rankings)
       ORDER BY score DESC NULLS LAST
       LIMIT 1`,
    );
    if (top) {
      const existing = await pgOne<{ id: number }>(
        `SELECT id FROM weekly_prizes WHERE week_start = $1`,
        [top.week_start],
      );
      if (!existing) {
        await pgQuery(
          `INSERT INTO weekly_prizes
             (week_start, week_end, winner_member_id, hybrid_score, prize_status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'por_definir', now(), now())
           ON CONFLICT (week_start) DO NOTHING`,
          [top.week_start, top.week_end, top.member_id, top.score],
        );
      }
    }

    // Mark job as successful
    if (jobRunId) {
      await pgQuery(
        `UPDATE job_runs SET status = 'success', ended_at = now(), rows_affected = $1 WHERE id = $2`,
        [r?.count ?? 0, jobRunId],
      );
    }

    return { rows_updated: r?.count ?? 0, weeks_processed: weeksProcessed, job_run_id: jobRunId };
  } catch (e: any) {
    if (jobRunId) {
      await pgQuery(
        `UPDATE job_runs SET status = 'failed', ended_at = now(), error_message = $1 WHERE id = $2`,
        [String(e?.message ?? e), jobRunId],
      );
    }
    throw e;
  } finally {
    // Always release advisory lock
    await pgQuery(`SELECT pg_advisory_unlock(${ADVISORY_LOCK_KEY})`).catch(() => null);
  }
}

export const recalcWeeklyRankings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    return doRecalcWeeklyRankings();
  });
