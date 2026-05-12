import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";

type KPI = {
  totalMembers: number;
  byTier: { tier: string; count: number }[];
  openSaidas: number;
  pendingTagRequests: number;
  totalStock: number;
  topWeek: { display_name: string | null; nick: string | null; score: number }[];
};

export const getDashboardKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<KPI> => {
    const [members, byTier, saidas, tags, stock, top] = await Promise.all([
      pgOne<{ count: string }>(
        "select count(*)::text as count from members where status_lifecycle is null or status_lifecycle = 'active'"
      ),
      pgQuery<{ tier: string; count: string }>(
        `select coalesce(tier, 'unknown') as tier, count(*)::text as count
         from members
         where (status_lifecycle is null or status_lifecycle = 'active')
         group by 1 order by 2 desc`
      ),
      pgOne<{ count: string }>(
        `select count(*)::text as count from operations
         where status in ('planeada','em_curso','em_liquidacao')`
      ).catch(() => ({ count: "0" })),
      pgOne<{ count: string }>(
        "select count(*)::text as count from tag_requests where status = 'pending'"
      ).catch(() => ({ count: "0" })),
      pgOne<{ total: string }>(
        "select coalesce(sum(qty),0)::text as total from inventory_balance"
      ).catch(() => ({ total: "0" })),
      pgQuery<{ display_name: string | null; nick: string | null; score: number }>(
        `select m.display_name, m.nick, wr.score::float as score
         from weekly_rankings wr
         join members m on m.id = wr.member_id
         where wr.week_start = (select max(week_start) from weekly_rankings)
         order by wr.score desc nulls last
         limit 3`
      ).catch(() => []),
    ]);

    return {
      totalMembers: Number(members?.count ?? 0),
      byTier: byTier.map((r) => ({ tier: r.tier, count: Number(r.count) })),
      openSaidas: Number(saidas?.count ?? 0),
      pendingTagRequests: Number(tags?.count ?? 0),
      totalStock: Number(stock?.total ?? 0),
      topWeek: top,
    };
  });
