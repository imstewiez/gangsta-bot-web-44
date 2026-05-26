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
  material_points: number;
  sales_points: number;
  ops_points: number;
  kills_count: number;
  wins_count: number;
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
  // Saídas stats
  winRate: number; // % de vitórias nas saídas fechadas/finalizadas
  avgKillsPerSaida: number;
  topOpsParticipants: { display_name: string | null; tier: string | null; ops: number }[];
  lastSaida: {
    tipo: string | null;
    spot: string | null;
    scheduled_at: string | null;
    was_profitable: boolean | null;
    our_kills: number | null;
    enemy_count: number | null;
    survivors: number;
    deaths: number;
    mvp_name: string | null;
    mvp_kills: number;
  } | null;
  // Existing
  byTier: { tier: string; count: number }[];
  topByTier: { tier: string; name: string | null; score: number }[];
  topWeek: RankRow[];
  topWeekLabel: string | null;
  topPrevWeek: RankRow[];
  topPrevWeekLabel: string | null;
  topMonth: RankRow[];
  topMonthLabel: string | null;
  prize: PrizeHighlight | null;
};

async function topForWeek(weekStart: string | null): Promise<RankRow[]> {
  if (!weekStart) return [];
  return pgQuery<RankRow>(
    `select m.display_name, m.nickname as nick,
            coalesce(wr.total_score, 0)::float as score,
            coalesce(wr.deliveries,0) as deliveries,
            coalesce(wr.sales,0) as sales,
            coalesce(wr.operations_count,0) as ops,
            coalesce(wr.material_points,0) as material_points,
            coalesce(wr.sales_points,0) as sales_points,
            coalesce(wr.ops_points,0) as ops_points,
            coalesce(wr.kills_count,0) as kills_count,
            coalesce(wr.wins_count,0) as wins_count
     from weekly_rankings wr
     join members m on m.id = wr.member_id
     where wr.week_start = $1
       and m.deleted_at is null
       and coalesce(m.lifecycle_state::text, 'active') in ('active', 'promoted')
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
      topByTier,
      newMembers,
      saidasWeek,
      opsWeek,
      killsWeek,
      winRateRows,
      avgKillsRow,
      topOpsRow,
      lastSaidaRow,
      weeks,
      monthRows,
      prize,
    ] = await Promise.all([
      pgQuery<{ tier: string; count: string }>(
        `select coalesce(tier, 'unknown') as tier, count(*)::text as count
         from members
         where deleted_at is null
           and coalesce(lifecycle_state::text, 'active') in ('active', 'promoted')
         group by 1 order by 2 desc`,
      ).catch(() => []),
      pgQuery<{ tier: string; name: string | null; score: number }>(
        `select m.tier, m.display_name as name, coalesce(s.total_score, 0)::float as score
         from members m
         left join all_time_stats s on s.member_id = m.id
         where m.deleted_at is null
           and coalesce(m.lifecycle_state::text, 'active') in ('active', 'promoted')
         order by m.tier, coalesce(s.total_score, 0) desc`,
      ).catch(() => []),
      pgOne<{ count: string }>(
        `select count(*)::text as count from members
         where deleted_at is null
           and coalesce(lifecycle_state::text, 'active') in ('active', 'promoted')
           and joined_at >= now() - interval '7 days'`,
      ).catch(() => ({ count: "0" })),
      pgOne<{ count: string }>(
        `select count(*)::text as count from operations
         where deleted_at is null
           and status in ('concluida','cancelada')
           and coalesce(end_time, start_time, date::timestamp) >= now() - interval '7 days'`,
      ).catch(() => ({ count: "0" })),
      pgOne<{ count: string }>(
        `select count(*)::text as count from operations
         where deleted_at is null
           and coalesce(start_time, date::timestamp, created_at) >= now() - interval '7 days'`,
      ).catch(() => ({ count: "0" })),
      pgOne<{ count: string }>(
        `select coalesce(sum(kills_total)::text, '0') as count from all_time_stats`,
      ).catch(() => ({ count: "0" })),
      pgQuery<{ wins: number; total: number }>(
        `select
           count(*) filter (where was_profitable = true)::int as wins,
           count(*)::int as total
         from operations
         where deleted_at is null
           and status = 'concluida'
           and had_fight = true
           and coalesce(end_time, start_time, date::timestamp) >= now() - interval '7 days'`,
      ).catch(() => [{ wins: 0, total: 0 }]),
      pgOne<{ avg: string }>(
        `select coalesce(avg(coalesce(our_kills,0))::text, '0') as avg
         from operations
         where deleted_at is null
           and status in ('concluida','cancelada')
           and coalesce(end_time, start_time, date::timestamp) >= now() - interval '7 days'`,
      ).catch(() => ({ avg: "0" })),
      pgQuery<{ display_name: string | null; tier: string | null; ops: number }>(
        `select m.display_name, m.tier,
                sum(coalesce(wr.operations_count,0))::int as ops
         from weekly_rankings wr
         join members m on m.id = wr.member_id
         where wr.week_start = (select max(week_start) from weekly_rankings)
           and m.deleted_at is null
           and coalesce(m.lifecycle_state::text, 'active') in ('active', 'promoted')
         group by m.display_name, m.tier
         having sum(coalesce(wr.operations_count,0)) > 0
         order by ops desc
         limit 3`,
      ).catch(() => []),
      pgOne<{
        tipo: string | null;
        spot: string | null;
        scheduled_at: string | null;
        was_profitable: boolean | null;
        our_kills: number | null;
        enemy_count: number | null;
        survivors: number;
        deaths: number;
        mvp_name: string | null;
        mvp_kills: number;
      }>(
        `select
          o.operation_type as tipo,
          o.spot,
          coalesce(o.end_time, o.start_time, o.date::timestamp)::text as scheduled_at,
          o.was_profitable,
          o.our_kills,
          o.enemy_count,
          coalesce(count(*) filter (where p.survived), 0)::int as survivors,
          coalesce(count(*) filter (where p.died), 0)::int as deaths,
          coalesce(mvp.display_name, mvp.nickname) as mvp_name,
          coalesce(mvp_kills.kills, 0)::int as mvp_kills
        from operations o
        left join operation_participants p on p.operation_id = o.id
        left join lateral (
          select member_id, sum(kills)::int as kills
          from (
            select p2.member_id, count(*)::int as kills
            from kill_logs kl
            join operation_participants p2 on p2.operation_id = o.id and p2.member_id = kl.killer_id
            where kl.saida_id = o.id
            group by p2.member_id
            union all
            select p2.member_id, p2.kills as kills
            from operation_participants p2
            where p2.operation_id = o.id and p2.kills > 0
          ) combined
          group by member_id
          order by sum(kills) desc
          limit 1
        ) mvp_kills on true
        left join members mvp on mvp.id = mvp_kills.member_id
        where o.deleted_at is null
          and o.status = 'concluida'
        group by o.id, o.operation_type, o.spot, o.end_time, o.start_time, o.date,
                 o.was_profitable, o.our_kills, o.enemy_count,
                 mvp.display_name, mvp.nickname, mvp_kills.kills
        order by coalesce(o.end_time, o.start_time, o.date::timestamp) desc
        limit 1`,
      ).catch(() => null),
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
                sum(coalesce(wr.total_score, 0))::float as score,
                sum(coalesce(wr.deliveries,0))::int as deliveries,
                sum(coalesce(wr.sales,0))::int as sales,
                sum(coalesce(wr.operations_count,0))::int as ops,
                sum(coalesce(wr.material_points,0))::int as material_points,
                sum(coalesce(wr.sales_points,0))::int as sales_points,
                sum(coalesce(wr.ops_points,0))::int as ops_points,
                sum(coalesce(wr.kills_count,0))::int as kills_count,
                sum(coalesce(wr.wins_count,0))::int as wins_count
         from weekly_rankings wr
         join members m on m.id = wr.member_id
         where wr.week_start >= date_trunc('month', current_date)::date
           and m.deleted_at is null
           and coalesce(m.lifecycle_state::text, 'active') in ('active', 'promoted')
         group by m.display_name, m.nickname
         having sum(coalesce(wr.total_score, 0)) > 0
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

    const wr = winRateRows[0] ?? { wins: 0, total: 0 };

    return {
      newMembersWeek: Number(newMembers?.count ?? 0),
      totalSaidasWeek: Number(saidasWeek?.count ?? 0),
      totalKillsWeek: Number(killsWeek?.count ?? 0),
      totalOpsWeek: Number(opsWeek?.count ?? 0),
      winRate: wr.total > 0 ? Math.round((wr.wins / wr.total) * 100) : 0,
      avgKillsPerSaida: Number(Number(avgKillsRow?.avg ?? 0).toFixed(1)),
      topOpsParticipants: topOpsRow,
      lastSaida: lastSaidaRow,
      byTier: byTier.map((r) => ({ tier: r.tier, count: Number(r.count) })),
      topByTier: topByTier.map((r) => ({ tier: r.tier, name: r.name, score: Number(r.score) })),
      topWeek,
      topWeekLabel: latestWeek,
      topPrevWeek,
      topPrevWeekLabel: prevWeek,
      topMonth: monthRows,
      topMonthLabel: monthLabel,
      prize,
    };
  });


