import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";

type RankRow = {
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

type PrizeHighlight = {
  winner_name: string | null;
  winner_tier: string | null;
  score: number | null;
  prize_description: string | null;
  prize_status: string | null;
  week_start: string | null;
  week_label: string | null;
  status: "defined" | "in_progress" | "closed" | null;
};

type HomeKpis = {
  newMembersWeek: number;
  totalSaidasWeek: number;
  totalKillsWeek: number;
  totalOpsWeek: number;
  winRate: number;
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

const ACTIVE_ORG_TIERS = `('young_blood','o_gunao','gangster_fodido','patrao_di_zona','real_gangster','og','kingpin','manda_chuva')`;

const ACTIVE_MEMBER_CONDITION = `
  m.deleted_at is null
  and coalesce(m.lifecycle_state::text, m.status, 'active') in ('active','ativo','promoted')
  and m.tier in ${ACTIVE_ORG_TIERS}
`;

function scoreCtes(startSql: string, endSql: string) {
  return `
    with bounds as (select ${startSql} as dstart, ${endSql} as dend),
    active_members as (
      select m.id, m.display_name, m.nickname, m.tier
      from members m
      where ${ACTIVE_MEMBER_CONDITION}
    ),
    delivery_movements as (
      select im.*,
             regexp_replace(coalesce(im.notes,''), '^delivery:', '') as source_id
      from inventory_movements im
      cross join bounds
      where im.movement_type in ('entrega_bairrista','entrega_oficial')
        and im.member_id is not null
        and im.quantity > 0
        and im.created_at >= bounds.dstart
        and im.created_at < bounds.dend + interval '1 day'
    ),
    deliveries_agg as (
      select dm.member_id,
             count(distinct coalesce(nullif(dm.source_id,''), dm.id::text))::int as deliveries,
             coalesce(sum(dm.quantity * case
               when lower(coalesce(i.category,'')) in ('quimicos_droga','dinheiro') then 0
               else coalesce(i.xp_points, 0)
             end), 0)::int as material_points
      from delivery_movements dm
      left join items i on i.id = dm.item_id
      group by dm.member_id
    ),
    sales_movements as (
      select im.*,
             coalesce(
               nullif(regexp_replace(coalesce(im.notes,''), '^delivery:', ''), ''),
               nullif(regexp_replace(coalesce(im.notes,''), '^order:', ''), '')
             ) as source_id
      from inventory_movements im
      cross join bounds
      where im.movement_type = 'venda_bairrista'
        and im.member_id is not null
        and im.quantity < 0
        and im.created_at >= bounds.dstart
        and im.created_at < bounds.dend + interval '1 day'
    ),
    sales_agg as (
      select sm.member_id,
             count(distinct coalesce(nullif(sm.source_id,''), sm.id::text))::int as sales,
             count(distinct coalesce(nullif(sm.source_id,''), sm.id::text))::int as sales_points
      from sales_movements sm
      group by sm.member_id
    ),
    ops_agg as (
      select p.member_id,
             count(*)::int as ops,
             count(*) filter (where o.was_profitable = true)::int as wins,
             count(*) filter (where p.died = true)::int as deaths
      from operation_participants p
      join operations o on o.id = p.operation_id and o.deleted_at is null
      join active_members am on am.id = p.member_id
      cross join bounds
      where o.status = 'concluida'
        and coalesce(o.end_time, o.start_time, o.date::timestamp) >= bounds.dstart
        and coalesce(o.end_time, o.start_time, o.date::timestamp) < bounds.dend + interval '1 day'
      group by p.member_id
    ),
    kills_logs_agg as (
      select killer_id as member_id, count(*)::int as kills
      from kill_logs
      join active_members am on am.id = killer_id
      cross join bounds
      where killer_id is not null
        and date >= bounds.dstart
        and date <= bounds.dend
      group by killer_id
    ),
    kills_ops_agg as (
      select p.member_id, sum(p.kills)::int as kills
      from operation_participants p
      join operations o on o.id = p.operation_id and o.deleted_at is null
      join active_members am on am.id = p.member_id
      cross join bounds
      where o.status = 'concluida'
        and coalesce(o.end_time, o.start_time, o.date::timestamp) >= bounds.dstart
        and coalesce(o.end_time, o.start_time, o.date::timestamp) < bounds.dend + interval '1 day'
        and p.kills > 0
      group by p.member_id
    ),
    kills_agg as (
      select coalesce(l.member_id, o.member_id) as member_id,
             coalesce(l.kills, 0) + coalesce(o.kills, 0) as kills
      from kills_logs_agg l
      full outer join kills_ops_agg o on l.member_id = o.member_id
    ),
    scores as (
      select am.id as member_id,
             am.display_name,
             am.nickname as nick,
             am.tier,
             coalesce(d.deliveries, 0)::int as deliveries,
             coalesce(s.sales, 0)::int as sales,
             coalesce(o.ops, 0)::int as ops,
             coalesce(d.material_points, 0)::int as material_points,
             coalesce(s.sales_points, 0)::int as sales_points,
             (coalesce(o.ops, 0) * 5 + coalesce(o.wins, 0) * 10)::int as ops_points,
             coalesce(k.kills, 0)::int as kills_count,
             coalesce(o.wins, 0)::int as wins_count,
             coalesce(o.deaths, 0)::int as deaths_count,
             (coalesce(d.material_points, 0)
              + coalesce(s.sales_points, 0) * 5
              + coalesce(o.ops, 0) * 5
              + coalesce(o.wins, 0) * 10
              + coalesce(k.kills, 0) * 3
              - coalesce(o.deaths, 0) * 5)::float8 as score
      from active_members am
      left join deliveries_agg d on d.member_id = am.id
      left join sales_agg s on s.member_id = am.id
      left join ops_agg o on o.member_id = am.id
      left join kills_agg k on k.member_id = am.id
    )
  `;
}

async function topForRange(startSql: string, endSql: string, limit = 5): Promise<RankRow[]> {
  return pgQuery<RankRow>(
    `${scoreCtes(startSql, endSql)}
     select display_name, nick, score, deliveries, sales, ops,
            material_points, sales_points, ops_points, kills_count, wins_count
     from scores
     where score > 0
     order by score desc nulls last
     limit ${limit}`,
  ).catch(() => []);
}

async function topByTierAllTime(): Promise<{ tier: string; name: string | null; score: number }[]> {
  return pgQuery<{ tier: string; name: string | null; score: number }>(
    `${scoreCtes(`'1900-01-01'::date`, `current_date`)}
     select tier, display_name as name, score
     from (
       select tier, display_name, score,
              row_number() over (partition by tier order by score desc nulls last) as rn
       from scores
       where score > 0
     ) ranked
     where rn <= 3
     order by tier, score desc nulls last`,
  ).catch(() => []);
}

export const getHomeKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<HomeKpis> => {
    const currentWeekStart = `date_trunc('week', current_date)::date`;
    const currentWeekEnd = `(date_trunc('week', current_date)::date + interval '6 days')::date`;
    const prevWeekStart = `(date_trunc('week', current_date)::date - interval '7 days')::date`;
    const prevWeekEnd = `(date_trunc('week', current_date)::date - interval '1 day')::date`;
    const monthStart = `date_trunc('month', current_date)::date`;
    const monthEnd = `(date_trunc('month', current_date)::date + interval '1 month' - interval '1 day')::date`;

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
      weekLabels,
      topWeek,
      topPrevWeek,
      monthRows,
      prize,
    ] = await Promise.all([
      pgQuery<{ tier: string; count: string }>(
        `select coalesce(m.tier, 'unknown') as tier, count(*)::text as count
         from members m
         where ${ACTIVE_MEMBER_CONDITION}
         group by 1 order by 2 desc`,
      ).catch(() => []),
      topByTierAllTime(),
      pgOne<{ count: string }>(
        `select count(*)::text as count from members m
         where ${ACTIVE_MEMBER_CONDITION}
           and m.joined_at >= now() - interval '7 days'`
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
        `select coalesce(sum(kills)::text, '0') as count from (
          select count(*) as kills from kill_logs kl join members m on m.id = kl.killer_id where ${ACTIVE_MEMBER_CONDITION} and kl.date >= now() - interval '7 days'
          union all
          select coalesce(sum(p.kills),0)::int as kills
          from operation_participants p
          join operations o on o.id = p.operation_id and o.deleted_at is null
          join members m on m.id = p.member_id
          where ${ACTIVE_MEMBER_CONDITION} and o.status = 'concluida' and coalesce(o.end_time, o.start_time, o.date::timestamp) >= now() - interval '7 days'
        ) src`,
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
           and status = 'concluida'
           and coalesce(end_time, start_time, date::timestamp) >= now() - interval '7 days'`,
      ).catch(() => ({ avg: "0" })),
      pgQuery<{ display_name: string | null; tier: string | null; ops: number }>(
        `select m.display_name, m.tier, count(*)::int as ops
         from operation_participants p
         join operations o on o.id = p.operation_id and o.deleted_at is null
         join members m on m.id = p.member_id
         where o.status = 'concluida'
           and ${ACTIVE_MEMBER_CONDITION}
           and coalesce(o.end_time, o.start_time, o.date::timestamp) >= date_trunc('week', current_date)::date
           and coalesce(o.end_time, o.start_time, o.date::timestamp) < date_trunc('week', current_date)::date + interval '7 days'
         group by m.display_name, m.tier
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
      pgOne<{ current_start: string; prev_start: string; month_label: string; current_week_label: string }>(
        `select
           to_char(date_trunc('week', current_date)::date, 'YYYY-MM-DD') as current_start,
           to_char((date_trunc('week', current_date)::date - interval '7 days')::date, 'YYYY-MM-DD') as prev_start,
           to_char(current_date, 'TMMonth YYYY') as month_label,
           to_char(date_trunc('week', current_date)::date,'DD/MM') || ' – ' || to_char((date_trunc('week', current_date)::date + interval '6 days')::date,'DD/MM') as current_week_label`,
      ).catch(() => null),
      topForRange(currentWeekStart, currentWeekEnd),
      topForRange(prevWeekStart, prevWeekEnd),
      topForRange(monthStart, monthEnd),
      pgOne<PrizeHighlight>(
        `select m.display_name as winner_name, m.tier as winner_tier,
                wp.hybrid_score::float as score,
                wp.prize_description, wp.prize_status,
                to_char(wp.week_start,'YYYY-MM-DD') as week_start,
                to_char(wp.week_start,'DD/MM') || ' – ' || to_char(wp.week_end,'DD/MM') as week_label,
                'defined'::text as status
         from weekly_prizes wp
         left join members m on m.id = wp.winner_member_id
         where wp.week_start = date_trunc('week', current_date)::date
         limit 1`,
      ).catch(() => null),
    ]);

    const resolvedPrize = prize ?? (topWeek[0]
      ? {
          winner_name: topWeek[0].display_name ?? topWeek[0].nick,
          winner_tier: null,
          score: topWeek[0].score,
          prize_description: null,
          prize_status: "em_curso",
          week_start: weekLabels?.current_start ?? null,
          week_label: weekLabels?.current_week_label ?? null,
          status: "in_progress" as const,
        }
      : null);

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
      topWeekLabel: weekLabels?.current_start ?? null,
      topPrevWeek,
      topPrevWeekLabel: weekLabels?.prev_start ?? null,
      topMonth: monthRows,
      topMonthLabel: weekLabels?.month_label ?? null,
      prize: resolvedPrize,
    };
  });
