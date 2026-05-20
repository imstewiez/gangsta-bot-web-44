import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery } from "./pg.server";

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

export const getLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { period?: LeaderboardPeriod; sortBy?: LeaderboardSortBy; sortDir?: "asc" | "desc" }) => ({
    period: d?.period ?? "week",
    sortBy: (d?.sortBy as LeaderboardSortBy) ?? "score",
    sortDir: d?.sortDir ?? "desc",
  }))
  .handler(async ({ data }): Promise<LeaderRow[]> => {
    const where =
      data.period === "week"
        ? `wr.week_start = (select max(week_start) from weekly_rankings)`
        : data.period === "month"
          ? `wr.week_start >= date_trunc('month', current_date)::date`
          : `true`;

    const sortCol = SORT_COLS[data.sortBy] ?? "score";
    const sortDir = data.sortDir === "asc" ? "asc" : "desc";

    try {
      const periodWhere =
        data.period === "week"
          ? `wr.week_start = (select max(week_start) from weekly_rankings)`
          : data.period === "month"
            ? `wr.week_start >= date_trunc('month', current_date)::date`
            : `true`;

      const weekStart = data.period === "week"
        ? `(select max(week_start) from weekly_rankings)`
        : data.period === "month"
          ? `date_trunc('month', current_date)::date`
          : `'1900-01-01'::date`;
      const weekEnd = data.period === "week"
        ? `(select max(week_end) from weekly_rankings)`
        : data.period === "month"
          ? `(date_trunc('month', current_date)::date + interval '1 month' - interval '1 day')::date`
          : `current_date`;

      // Debug: check kill_logs data
      const killCount = await pgQuery<{ total: number; min_date: string; max_date: string }>(
        `select count(*)::int as total, min(date)::text as min_date, max(date)::text as max_date from kill_logs`
      );
      console.log("[leaderboard] kill_logs total:", killCount[0]?.total, "range:", killCount[0]?.min_date, "-", killCount[0]?.max_date);

      const killInRange = await pgQuery<{ kills_in_range: number }>(
        `select count(*)::int as kills_in_range from kill_logs where date >= ${weekStart} and date <= ${weekEnd}`
      );
      console.log("[leaderboard] kills in range:", killInRange[0]?.kills_in_range, "weekStart:", weekStart, "weekEnd:", weekEnd);

      const rows = await pgQuery<LeaderRow>(
        `with kills_agg as (
            select killer_id as member_id, count(*)::int as kills
              from kill_logs
             where date >= ${weekStart} and date <= ${weekEnd}
               and killer_id is not null
             group by killer_id
         ),
         deaths_agg as (
            select op.member_id, count(*) filter (where op.died = true)::int as deaths
              from operation_participants op
              join operations o on o.id = op.operation_id and o.deleted_at is null
             where o.date >= ${weekStart} and o.date <= ${weekEnd}
               and o.status = 'concluida'
             group by op.member_id
         ),
         member_totals as (
            select member_id, kills_total, deaths_total
              from member_saida_stats
         )
         select wr.member_id,
                m.display_name, m.nickname as nick, m.tier,
                coalesce(nullif(ka.kills,0), mt.kills_total, 0)::int as kills,
                coalesce(nullif(da.deaths,0), mt.deaths_total, 0)::int as deaths,
                case when coalesce(nullif(da.deaths,0), mt.deaths_total, 0) = 0
                     then coalesce(nullif(ka.kills,0), mt.kills_total, 0)::float8
                     else (coalesce(nullif(ka.kills,0), mt.kills_total, 0)::float8
                         / nullif(coalesce(nullif(da.deaths,0), mt.deaths_total, 0),0)::float8) end as kd,
                sum(coalesce(wr.deliveries,0))::int            as deliveries,
                sum(coalesce(wr.sales,0))::int                 as sales,
                sum(coalesce(wr.operations_count,0))::int      as ops,
                sum(coalesce(wr.wins_count,0))::int            as wins,
                sum(coalesce(wr.hybrid_score,0))::float8       as score
           from weekly_rankings wr
           join members m on m.id = wr.member_id
           left join kills_agg ka on ka.member_id = m.id
           left join deaths_agg da on da.member_id = m.id
           left join member_totals mt on mt.member_id = m.id
          where ${periodWhere}
            and m.deleted_at is null
            and coalesce(m.lifecycle_state, 'active') in ('active', 'promoted')
          group by wr.member_id, m.display_name, m.nickname, m.tier, ka.kills, da.deaths, mt.kills_total, mt.deaths_total
          order by ${sortCol} ${sortDir} nulls last
          limit 200`
      );
      return rows;
    } catch (e) {
      const errMsg = typeof e === "object" && e !== null ? JSON.stringify(e) : String(e);
      console.error("[leaderboard] query failed:", errMsg);
      throw new Error("Leaderboard query failed: " + errMsg.slice(0, 500));
    }
  });
