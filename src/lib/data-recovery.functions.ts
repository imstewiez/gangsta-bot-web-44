// Data recovery & diagnostics — superadmin only.
// These functions help rebuild derived tables when data is lost or inconsistent.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { assertSuperAdmin } from "./admin.functions";

export async function doRecalcWeeklyRankings(): Promise<{ rows_updated: number }> {
  // Clear recent weeks and recalculate
  await pgQuery(`delete from weekly_rankings where week_start >= '2026-04-20'`);

  const weekRows = await pgQuery<{ ws: string }>(
    `select distinct date_trunc('week', d)::date::text as ws
     from generate_series('2026-04-20'::date, current_date, '1 day'::interval) d
     order by 1`
  );

  for (const row of weekRows) {
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
      ORDER BY hybrid_score DESC`,
      [ws]
    );
  }

  const r = await pgOne<{ count: number }>(`select count(*)::int as count from weekly_rankings`);

  // Auto-generate prize for the most recent week if not already exists
  const top = await pgOne<{
    member_id: number;
    week_start: string;
    week_end: string;
    score: number | null;
  }>(
    `select wr.member_id, wr.week_start, wr.week_end,
            coalesce(wr.hybrid_score, wr.normalized_score, wr.performance_score)::float as score
     from weekly_rankings wr
     where wr.week_start = (select max(week_start) from weekly_rankings)
     order by score desc nulls last
     limit 1`,
  );
  if (top) {
    const existing = await pgOne<{ id: number }>(
      `select id from weekly_prizes where week_start = $1`,
      [top.week_start],
    );
    if (!existing) {
      await pgQuery(
        `insert into weekly_prizes
           (week_start, week_end, winner_member_id, hybrid_score, prize_status, created_at, updated_at)
         values ($1, $2, $3, $4, 'por_definir', now(), now())`,
        [top.week_start, top.week_end, top.member_id, top.score],
      );
    }
  }

  return { rows_updated: r?.count ?? 0 };
}

export const recalcWeeklyRankings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    return doRecalcWeeklyRankings();
  });
