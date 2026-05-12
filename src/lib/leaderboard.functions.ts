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

export const getLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { period?: LeaderboardPeriod }) => ({ period: d?.period ?? "week" }))
  .handler(async ({ data }): Promise<LeaderRow[]> => {
    const where =
      data.period === "week"
        ? `wr.week_start = (select max(week_start) from weekly_rankings)`
        : data.period === "month"
          ? `wr.week_start >= date_trunc('month', current_date)::date`
          : `true`;

    return pgQuery<LeaderRow>(
      `select wr.member_id,
              m.display_name, m.nickname as nick, m.tier,
              sum(coalesce(wr.kills_count,0))::int                as kills,
              sum(coalesce(wr.deaths_in_ops,0))::int              as deaths,
              case when sum(coalesce(wr.deaths_in_ops,0)) = 0
                   then sum(coalesce(wr.kills_count,0))::float
                   else (sum(coalesce(wr.kills_count,0))::float
                       / nullif(sum(coalesce(wr.deaths_in_ops,0)),0)) end as kd,
              sum(coalesce(wr.deliveries,0))::int                 as deliveries,
              sum(coalesce(wr.sales,0))::int                      as sales,
              sum(coalesce(wr.operations_count,0))::int           as ops,
              sum(coalesce(wr.wins_count,0))::int                 as wins,
              sum(greatest(
                coalesce(wr.hybrid_score,0),
                coalesce(wr.normalized_score,0),
                coalesce(wr.performance_score,0),
                (coalesce(wr.deliveries,0) + coalesce(wr.sales,0) + coalesce(wr.operations_count,0) * 5)
              ))::float                                            as score
         from weekly_rankings wr
         join members m on m.id = wr.member_id
        where ${where}
          and m.deleted_at is null
        group by wr.member_id, m.display_name, m.nickname, m.tier
        order by score desc nulls last
        limit 200`
    ).catch(() => []);
  });
