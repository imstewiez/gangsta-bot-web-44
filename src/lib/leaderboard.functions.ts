import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery } from "./pg.server";
import { logger } from "./logger.server";
import { LeaderboardPeriodSchema, LeaderboardSortBySchema, SortDirSchema } from "./security";

export type LeaderRow = {
  member_id: number;
  display_name: string | null;
  nick: string | null;
  tier: string | null;
  kills: number;
  deaths: number;
  kd: number;
  deliveries: number;
  sales: number;
  ops: number;
  wins: number;
  score: number;
};

export type LeaderboardPeriod = "week" | "month" | "all";
export type LeaderboardSortBy = "score" | "kills" | "deaths" | "kd" | "deliveries" | "sales" | "ops" | "wins";

const SORT_COLS: Record<LeaderboardSortBy, string> = {
  score: "score",
  kills: "kills",
  deaths: "deaths",
  kd: "kd",
  deliveries: "deliveries",
  sales: "sales",
  ops: "ops",
  wins: "wins",
};

function periodBoundsSql(period: LeaderboardPeriod): { start: string; end: string } {
  if (period === "week") {
    return {
      start: `date_trunc('week', current_date)::date`,
      end: `(date_trunc('week', current_date)::date + interval '6 days')::date`,
    };
  }
  if (period === "month") {
    return {
      start: `date_trunc('month', current_date)::date`,
      end: `(date_trunc('month', current_date)::date + interval '1 month' - interval '1 day')::date`,
    };
  }
  return {
    start: `'1900-01-01'::date`,
    end: `current_date`,
  };
}

export const getLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { period?: LeaderboardPeriod; sortBy?: LeaderboardSortBy; sortDir?: "asc" | "desc" }) => ({
    period: LeaderboardPeriodSchema.optional().parse(d?.period) ?? "week",
    sortBy: LeaderboardSortBySchema.optional().parse(d?.sortBy) ?? "score",
    sortDir: SortDirSchema.optional().parse(d?.sortDir) ?? "desc",
  }))
  .handler(async ({ data }): Promise<LeaderRow[]> => {
    const sortCol = SORT_COLS[data.sortBy] ?? "score";
    const sortDir = data.sortDir === "asc" ? "asc" : "desc";
    const bounds = periodBoundsSql(data.period);

    try {
      const rows = await pgQuery<LeaderRow>(
        `with bounds as (select ${bounds.start} as dstart, ${bounds.end} as dend),
         deliveries_agg as (
            select im.member_id,
                   count(*)::int as deliveries,
                   coalesce(sum(abs(im.quantity) * coalesce(i.xp_points, 1)), 0)::int as material_points
              from inventory_movements im
              left join items i on i.id = im.item_id
              cross join bounds
             where im.movement_type in ('entrega_bairrista','entrega_oficial')
               and im.member_id is not null
               and im.created_at between bounds.dstart and bounds.dend + interval '1 day'
             group by im.member_id
         ),
         sales_agg as (
            select im.member_id,
                   count(*)::int as sales,
                   coalesce(sum(abs(im.quantity) * coalesce(i.xp_points, 1)), 0)::int as sales_points
              from inventory_movements im
              left join items i on i.id = im.item_id
              cross join bounds
             where im.movement_type = 'venda_bairrista'
               and im.member_id is not null
               and im.created_at between bounds.dstart and bounds.dend + interval '1 day'
             group by im.member_id
         ),
         ops_agg as (
            select p.member_id,
                   count(*)::int as ops,
                   count(*) filter (where o.was_profitable = true)::int as wins,
                   count(*) filter (where p.died = true)::int as deaths,
                   count(*) filter (where p.died = false)::int as survived
              from operation_participants p
              join operations o on o.id = p.operation_id and o.deleted_at is null
              cross join bounds
             where o.status = 'concluida'
               and coalesce(o.end_time, o.start_time, o.date::timestamp) between bounds.dstart and bounds.dend + interval '1 day'
             group by p.member_id
         ),
         kills_logs_agg as (
            select killer_id as member_id, count(*)::int as kills
              from kill_logs
              cross join bounds
             where killer_id is not null
               and date between bounds.dstart and bounds.dend
             group by killer_id
         ),
         kills_ops_agg as (
            select p.member_id, sum(p.kills)::int as kills
              from operation_participants p
              join operations o on o.id = p.operation_id and o.deleted_at is null
              cross join bounds
             where o.status = 'concluida'
               and coalesce(o.end_time, o.start_time, o.date::timestamp) between bounds.dstart and bounds.dend + interval '1 day'
               and p.kills > 0
             group by p.member_id
         ),
         kills_agg as (
            select coalesce(l.member_id, o.member_id) as member_id,
                   coalesce(l.kills, 0) + coalesce(o.kills, 0) as kills
              from kills_logs_agg l
              full outer join kills_ops_agg o on l.member_id = o.member_id
         )
         select m.id as member_id,
                m.display_name,
                m.nickname as nick,
                m.tier,
                coalesce(k.kills, 0)::int as kills,
                coalesce(o.deaths, 0)::int as deaths,
                case when coalesce(o.deaths, 0) = 0
                     then coalesce(k.kills, 0)::float8
                     else (coalesce(k.kills, 0)::float8 / nullif(coalesce(o.deaths, 0), 0)::float8)
                end as kd,
                coalesce(d.deliveries, 0)::int as deliveries,
                coalesce(s.sales, 0)::int as sales,
                coalesce(o.ops, 0)::int as ops,
                coalesce(o.wins, 0)::int as wins,
                (coalesce(d.material_points, 0) + coalesce(s.sales_points, 0)
                 + coalesce(o.ops, 0) * 5 + coalesce(o.wins, 0) * 10
                 + coalesce(k.kills, 0) * 3 - coalesce(o.deaths, 0) * 5)::float8 as score
           from members m
           left join deliveries_agg d on d.member_id = m.id
           left join sales_agg s on s.member_id = m.id
           left join ops_agg o on o.member_id = m.id
           left join kills_agg k on k.member_id = m.id
          where m.deleted_at is null
            and (m.status = 'ativo' or m.status is null)
            and coalesce(m.lifecycle_state, 'active') in ('active', 'promoted')
            and (coalesce(k.kills,0) + coalesce(o.ops,0) + coalesce(d.deliveries,0) + coalesce(s.sales,0) > 0)
          order by ${sortCol} ${sortDir} nulls last
          limit 200`
      );
      return rows;
    } catch (e) {
      const errMsg = typeof e === "object" && e !== null ? JSON.stringify(e) : String(e);
      logger.error("leaderboard_query_failed", { error: errMsg });
      throw new Error("Leaderboard query failed: " + errMsg.slice(0, 500));
    }
  });
