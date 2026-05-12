import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { withClient, pgQuery } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";

export type WeekInfo = {
  week_start: string;
  week_end: string;
  rows: number;
  last_recomputed_at: string | null;
};

export const listRecentWeeks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<WeekInfo[]> => {
    return pgQuery<WeekInfo>(
      `select week_start::text, week_end::text, count(*)::int as rows,
              max(created_at)::text as last_recomputed_at
         from weekly_rankings
        group by week_start, week_end
        order by week_start desc
        limit 8`,
    );
  });

/**
 * Recompute weekly_rankings for a given week. If no week is given, uses the
 * current ISO week (Mon..Sun). Aggregates from kill_logs, operations and
 * operation_participants; computes a hybrid_score with weights:
 *   kills(1.0) + saidas_won(2.0) + survival_rate(50) - deaths(0.5)
 *   + net_value_share(0.001)
 * Then upserts into weekly_rankings (one row per member with activity).
 */
export const recomputeWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { week_start?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Sem permissão");
    return withClient(async (c) => {
      await c.query("begin");
      try {
        // Determine week boundaries (Mon..Sun)
        const wk = await c.query(
          `select
             coalesce($1::date, date_trunc('week', now())::date) as ws,
             coalesce($1::date, date_trunc('week', now())::date) + interval '6 days' as we`,
          [data.week_start ?? null],
        );
        const ws = wk.rows[0].ws as Date;
        const we = wk.rows[0].we as Date;

        // Clear previous rows for this week
        await c.query(`delete from weekly_rankings where week_start = $1`, [
          ws,
        ]);

        // Aggregate per member
        const agg = await c.query(
          `with bounds as (select $1::date as ws, ($1::date + interval '6 days') as we),
            kills as (
              select killer_id as member_id, count(*)::int as kills_count
                from kill_logs, bounds
               where date between bounds.ws and bounds.we and killer_id is not null
               group by killer_id
            ),
            ops as (
              select p.member_id,
                     count(*)::int as operations_count,
                     count(*) filter (where o.was_profitable) ::int as wins_count,
                     count(*) filter (where o.was_profitable = false) ::int as loss_count,
                     count(*) filter (where p.died) ::int as deaths_in_ops,
                     count(*) filter (where p.survived) ::int as survived_in_ops,
                     coalesce(sum(p.net_material_delta),0)::numeric as net_profit_generated
                from operation_participants p
                join operations o on o.id = p.operation_id and o.deleted_at is null
                cross join bounds
               where coalesce(o.end_time, o.start_time, o.date::timestamp) between bounds.ws and bounds.we + interval '1 day'
                 and o.status = 'finalizada'
               group by p.member_id
            ),
            inv as (
              select member_id, count(*)::int as deliveries
                from inventory_movements, bounds
               where created_at between bounds.ws and bounds.we + interval '1 day'
                 and movement_type in ('entrada','delivery')
                 and member_id is not null
               group by member_id
            ),
            sales as (
              select member_id, count(*)::int as sales
                from inventory_movements, bounds
               where created_at between bounds.ws and bounds.we + interval '1 day'
                 and movement_type in ('saida','venda','sale')
                 and member_id is not null
               group by member_id
            )
            select m.id as member_id,
                   coalesce(k.kills_count,0) as kills_count,
                   coalesce(o.operations_count,0) as operations_count,
                   coalesce(o.wins_count,0) as wins_count,
                   coalesce(o.loss_count,0) as loss_count,
                   coalesce(o.deaths_in_ops,0) as deaths_in_ops,
                   coalesce(o.survived_in_ops,0) as survived_in_ops,
                   coalesce(o.net_profit_generated,0) as net_profit_generated,
                   coalesce(d.deliveries,0) as deliveries,
                   coalesce(s.sales,0) as sales
              from members m
              left join kills k on k.member_id = m.id
              left join ops o on o.member_id = m.id
              left join inv d on d.member_id = m.id
              left join sales s on s.member_id = m.id
             where m.deleted_at is null
               and (coalesce(k.kills_count,0) + coalesce(o.operations_count,0) + coalesce(d.deliveries,0) + coalesce(s.sales,0) > 0)`,
          [ws],
        );

        // Compute scores and upsert
        const rows = agg.rows.map((r) => {
          const ops = Number(r.operations_count);
          const survival = ops > 0 ? Number(r.survived_in_ops) / ops : 0;
          const wins = Number(r.wins_count);
          const kills = Number(r.kills_count);
          const deaths = Number(r.deaths_in_ops);
          const net = Number(r.net_profit_generated);
          const performance = kills + wins * 2 - deaths * 0.5;
          const hybrid = performance + survival * 50 + net * 0.001;
          return { ...r, survival, performance, hybrid };
        });
        rows.sort((a, b) => b.hybrid - a.hybrid);

        let pos = 0;
        for (const r of rows) {
          pos += 1;
          await c.query(
            `insert into weekly_rankings
              (member_id, week_start, week_end, deliveries, sales, operations_count, weighted_value,
               return_rate, rank_position, kills_count, wins_count, loss_count,
               net_profit_generated, survival_rate, performance_score, hybrid_score, normalized_score, created_at)
             values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, now())`,
            [
              r.member_id,
              ws,
              we,
              r.deliveries,
              r.sales,
              r.operations_count,
              r.net_profit_generated,
              r.survival,
              pos,
              r.kills_count,
              r.wins_count,
              r.loss_count,
              r.net_profit_generated,
              r.survival,
              r.performance,
              r.hybrid,
              rows.length > 0
                ? r.hybrid / Math.max(...rows.map((x) => x.hybrid || 1))
                : 0,
            ],
          );
        }

        await c.query(
          `insert into audit_logs (action, entity_type, entity_id, actor_id, after_state, created_at)
           values ('rankings_recompute','weekly_rankings', $1::text, $2, jsonb_build_object('rows', $3::int), now())`,
          [String(ws), `web:${context.userId}`, rows.length],
        );

        await c.query("commit");
        return {
          week_start:
            typeof ws === "string" ? ws : ws.toISOString().slice(0, 10),
          week_end: typeof we === "string" ? we : we.toISOString().slice(0, 10),
          rows_written: rows.length,
        };
      } catch (e) {
        await c.query("rollback");
        throw e;
      }
    });
  });
