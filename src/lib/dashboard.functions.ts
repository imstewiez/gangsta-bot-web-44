import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";

export type RankRow = {
  display_name: string | null;
  nick: string | null;
  score: number;
  deliveries: number;
  sales: number;
  ops: number;
};

export type PrizeHighlight = {
  winner_name: string | null;
  winner_tier: string | null;
  score: number | null;
  prize_description: string | null;
  prize_status: string | null;
  week_start: string | null;
};

export type HomeKpis = {
  // public-safe stats — visible to every member
  newMembersWeek: number;
  totalSaidasWeek: number; // operações fechadas/finalizadas na semana
  totalKillsWeek: number;
  totalOpsWeek: number; // saídas iniciadas na semana (qualquer estado)
  byTier: { tier: string; count: number }[];
  topWeek: RankRow[];
  topWeekLabel: string | null;
  topPrevWeek: RankRow[];
  topPrevWeekLabel: string | null;
  topMonth: RankRow[];
  topMonthLabel: string | null;
  prize: PrizeHighlight | null;
};

const SCORE_EXPR = `
  greatest(
    coalesce(wr.hybrid_score, 0)::float,
    coalesce(wr.normalized_score, 0)::float,
    coalesce(wr.performance_score, 0)::float,
    (coalesce(wr.deliveries,0) + coalesce(wr.sales,0) + coalesce(wr.operations_count,0) * 5)::float
  )
`;

async function topForWeek(weekStart: string | null): Promise<RankRow[]> {
  if (!weekStart) return [];
  return pgQuery<RankRow>(
    `select m.display_name, m.nickname as nick,
            ${SCORE_EXPR} as score,
            coalesce(wr.deliveries,0) as deliveries,
            coalesce(wr.sales,0) as sales,
            coalesce(wr.operations_count,0) as ops
     from weekly_rankings wr
     join members m on m.id = wr.member_id
     where wr.week_start = $1
       and m.deleted_at is null
     order by score desc nulls last
     limit 5`,
    [weekStart],
  ).catch(() => []);
}

export const getHomeKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<HomeKpis> => {
    const [
      byTier,
      newMembers,
      saidasWeek,
      opsWeek,
      killsWeek,
      weeks,
      monthRows,
      prize,
    ] = await Promise.all([
      pgQuery<{ tier: string; count: string }>(
        `select coalesce(tier, 'unknown') as tier, count(*)::text as count
         from members
         where deleted_at is null
           and (lifecycle_state is null or lifecycle_state::text = 'active')
         group by 1 order by 2 desc`,
      ).catch(() => []),
      pgOne<{ count: string }>(
        `select count(*)::text as count from members
         where deleted_at is null
           and joined_at >= now() - interval '7 days'`,
      ).catch(() => ({ count: "0" })),
      pgOne<{ count: string }>(
        `select count(*)::text as count from operations
         where deleted_at is null
           and status in ('finalizada','fechada','fechada_auto','encerrada')
           and coalesce(end_time, start_time, date::timestamp) >= now() - interval '7 days'`,
      ).catch(() => ({ count: "0" })),
      pgOne<{ count: string }>(
        `select count(*)::text as count from operations
         where deleted_at is null
           and coalesce(start_time, date::timestamp, created_at) >= now() - interval '7 days'`,
      ).catch(() => ({ count: "0" })),
      pgOne<{ count: string }>(
        `select count(*)::text as count from kill_logs
         where coalesce(date::timestamp, created_at) >= now() - interval '7 days'`,
      ).catch(() => ({ count: "0" })),
      pgQuery<{ week_start: string }>(
        `select to_char(week_start,'YYYY-MM-DD') as week_start
         from weekly_rankings
         where (hybrid_score > 0 or normalized_score > 0 or performance_score > 0
                or deliveries > 0 or sales > 0 or operations_count > 0)
         group by week_start
         order by week_start desc
         limit 2`,
      ).catch(() => []),
      pgQuery<RankRow>(
        `select m.display_name, m.nickname as nick,
                sum(${SCORE_EXPR})::float as score,
                sum(coalesce(wr.deliveries,0))::int as deliveries,
                sum(coalesce(wr.sales,0))::int as sales,
                sum(coalesce(wr.operations_count,0))::int as ops
         from weekly_rankings wr
         join members m on m.id = wr.member_id
         where wr.week_start >= date_trunc('month', current_date)::date
           and m.deleted_at is null
         group by m.display_name, m.nickname
         having sum(${SCORE_EXPR}) > 0
         order by score desc nulls last
         limit 5`,
      ).catch(() => []),
      pgOne<PrizeHighlight>(
        `select m.display_name as winner_name, m.tier as winner_tier,
                wp.hybrid_score::float as score,
                wp.prize_description, wp.prize_status,
                to_char(wp.week_start,'YYYY-MM-DD') as week_start
         from weekly_prizes wp
         left join members m on m.id = wp.winner_member_id
         order by wp.week_start desc
         limit 1`,
      ).catch(() => null),
    ]);

    const [latestWeek, prevWeek] = [
      weeks[0]?.week_start ?? null,
      weeks[1]?.week_start ?? null,
    ];
    const [topWeek, topPrevWeek] = await Promise.all([
      topForWeek(latestWeek),
      topForWeek(prevWeek),
    ]);

    const monthLabel = new Intl.DateTimeFormat("pt-PT", {
      month: "long",
      year: "numeric",
    }).format(new Date());

    return {
      newMembersWeek: Number(newMembers?.count ?? 0),
      totalSaidasWeek: Number(saidasWeek?.count ?? 0),
      totalKillsWeek: Number(killsWeek?.count ?? 0),
      totalOpsWeek: Number(opsWeek?.count ?? 0),
      byTier: byTier.map((r) => ({ tier: r.tier, count: Number(r.count) })),
      topWeek,
      topWeekLabel: latestWeek,
      topPrevWeek,
      topPrevWeekLabel: prevWeek,
      topMonth: monthRows,
      topMonthLabel: monthLabel,
      prize,
    };
  });

// Kept for /admin (chefia-only) — full sensitive KPIs
export type AdminKpis = {
  totalMembers: number;
  openSaidas: number;
  pendingTagRequests: number;
  totalStock: number;
};

export const getAdminKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminKpis> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Sem permissão");
    const [members, saidas, tags, stock] = await Promise.all([
      pgOne<{ count: string }>(
        `select count(*)::text as count from members
         where deleted_at is null
           and (lifecycle_state is null or lifecycle_state::text = 'active')`,
      ).catch(() => ({ count: "0" })),
      pgOne<{ count: string }>(
        `select count(*)::text as count from operations
         where status in ('planeada','em_curso','em_liquidacao','agendada','iniciada')
           and deleted_at is null`,
      ).catch(() => ({ count: "0" })),
      pgOne<{ count: string }>(
        "select count(*)::text as count from tag_requests where status = 'pending'",
      ).catch(() => ({ count: "0" })),
      pgOne<{ total: string }>(
        "select coalesce(sum(balance),0)::text as total from inventory_balance",
      ).catch(() => ({ total: "0" })),
    ]);
    return {
      totalMembers: Number(members?.count ?? 0),
      openSaidas: Number(saidas?.count ?? 0),
      pendingTagRequests: Number(tags?.count ?? 0),
      totalStock: Number(stock?.total ?? 0),
    };
  });
