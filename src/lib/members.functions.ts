import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import { IdSchema, NicknameSchema } from "./security";
import { logger } from "./logger.server";
import { notifyBot } from "./discord.server";
import type { CurrentMember } from "./pricing.shared";

export type MemberRow = {
  id: number;
  discord_id: string | null;
  display_name: string | null;
  nick: string | null;
  tier: string | null;
  role_label: string | null;
  joined_at: string | null;
  status_lifecycle: string | null;
};

type MemberWithStats = MemberRow & {
  kills: number;
  deaths: number;
  saidas: number;
  deliveries: number;
  sales: number;
};

type MemberStats = {
  kills: number;
  deaths: number;
  saidas: number;
  deliveries: number;
  sales: number;
  orders: number;
  wins: number;
  losses: number;
};

type MemberDetail = {
  member: MemberRow | null;
  contributions: { type: string; total: number }[];
  recentMovements: {
    id: number;
    type: string;
    item_id: number | null;
    item_name: string | null;
    qty: number;
    created_at: string;
  }[];
  kills: number;
  deaths: number;
  saidas: number;
  deliveries: number;
  vendas: number;
  orders: number;
};

const ACTIVE_ORG_TIER_LIST = [
  "young_blood",
  "o_gunao",
  "gangster_fodido",
  "patrao_di_zona",
  "real_gangster",
  "og",
  "kingpin",
  "manda_chuva",
];

const BAIRRISTA_VISIBLE_TIER_LIST = [
  "young_blood",
  "o_gunao",
  "gangster_fodido",
  "patrao_di_zona",
];

const RESPONSIBLE_TIER_LIST = ["patrao_di_zona", "kingpin", "manda_chuva"];

const ACTIVE_MEMBER_WHERE = `
  m.deleted_at is null
  and coalesce(m.lifecycle_state::text, m.status, 'active') in ('active','ativo','promoted')
  and m.tier = any($1::text[])
`;

function visibleMemberWhere(isManager: boolean): string {
  return `
    m.deleted_at is null
    and (
      coalesce(m.lifecycle_state::text, m.status, 'active') in ('active','ativo','promoted')
      ${isManager ? "or coalesce(m.lifecycle_state::text, m.status, 'active') in ('absent','ausente')" : ""}
    )
    and m.tier = any($1::text[])
  `;
}

const EMPTY_MEMBER_STATS: MemberStats = {
  kills: 0,
  deaths: 0,
  saidas: 0,
  deliveries: 0,
  sales: 0,
  orders: 0,
  wins: 0,
  losses: 0,
};

function visibleMemberTiersFor(me: CurrentMember | null): string[] {
  return me?.is_manager ? ACTIVE_ORG_TIER_LIST : BAIRRISTA_VISIBLE_TIER_LIST;
}

function emptyMemberDetail(): MemberDetail {
  return { member: null, contributions: [], recentMovements: [], kills: 0, deaths: 0, saidas: 0, deliveries: 0, vendas: 0, orders: 0 };
}

function memberSelect(isManager: boolean): string {
  return `m.id,
          ${isManager ? "m.discord_id" : "null as discord_id"},
          m.display_name,
          m.nickname as nick,
          m.tier,
          coalesce(m.role, m.tier, 'bairrista') as role_label,
          m.joined_at,
          coalesce(m.lifecycle_state::text, m.status, 'active') as status_lifecycle`;
}

const MEMBER_ORDER = `
  case coalesce(m.tier,'')
    when 'manda_chuva' then 1
    when 'kingpin' then 2
    when 'og' then 3
    when 'real_gangster' then 4
    when 'patrao_di_zona' then 5
    when 'gangster_fodido' then 6
    when 'o_gunao' then 7
    when 'young_blood' then 8
    else 9 end,
  m.display_name nulls last
`;

const STATS_AGG_CTES = `
  kill_logs_agg as (
    select killer_id as member_id, count(*)::int as kills
    from kill_logs
    where killer_id is not null
    group by killer_id
  ),
  kills_ops_agg as (
    select p.member_id, coalesce(sum(greatest(coalesce(p.kills, 0), 0)), 0)::int as kills
    from operation_participants p
    join operations o on o.id = p.operation_id and o.deleted_at is null
    where p.member_id is not null
      and o.status = 'concluida'
    group by p.member_id
  ),
  ops_agg as (
    select p.member_id,
           count(*)::int as saidas,
           count(*) filter (where coalesce(p.died, false) = true or coalesce(p.deaths_count, 0) > 0)::int as deaths,
           count(*) filter (where o.was_profitable = true)::int as wins,
           count(*) filter (where o.was_profitable = false)::int as losses
    from operation_participants p
    join operations o on o.id = p.operation_id and o.deleted_at is null
    where p.member_id is not null
      and o.status = 'concluida'
    group by p.member_id
  ),
  delivery_movements as (
    select im.*,
           case
             when coalesce(im.notes, '') ~ '^delivery:' then regexp_replace(im.notes, '^delivery:', '')
             else null
           end as source_id
    from inventory_movements im
    where im.member_id is not null
      and im.movement_type in ('entrega_bairrista', 'entrega_oficial')
      and im.quantity > 0
  ),
  deliveries_agg as (
    select dm.member_id,
           count(distinct coalesce(nullif(dm.source_id, ''), dm.id::text))::int as deliveries
    from delivery_movements dm
    group by dm.member_id
  ),
  sales_movements as (
    select im.*,
           case
             when coalesce(im.notes, '') ~ '^delivery:' then regexp_replace(im.notes, '^delivery:', '')
             when coalesce(im.notes, '') ~ '^order:' then regexp_replace(im.notes, '^order:', '')
             else null
           end as source_id
    from inventory_movements im
    where im.member_id is not null
      and im.movement_type = 'venda_bairrista'
      and im.quantity < 0
  ),
  sales_agg as (
    select sm.member_id,
           count(distinct coalesce(nullif(sm.source_id, ''), sm.id::text))::int as sales
    from sales_movements sm
    group by sm.member_id
  ),
  orders_agg as (
    select o.member_id,
           count(distinct coalesce(nullif(o.batch_id, ''), o.id::text))::int as orders
    from orders o
    where o.member_id is not null
    group by o.member_id
  )
`;

function nonNegativeInt(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

async function computeMemberStats(memberId: number): Promise<MemberStats> {
  const row = await pgOne<MemberStats>(
    `with ${STATS_AGG_CTES}
     select (coalesce(kl.kills, 0) + coalesce(ko.kills, 0))::int as kills,
            coalesce(o.deaths, 0)::int as deaths,
            coalesce(o.saidas, 0)::int as saidas,
            coalesce(d.deliveries, 0)::int as deliveries,
            coalesce(s.sales, 0)::int as sales,
            coalesce(ord.orders, 0)::int as orders,
            coalesce(o.wins, 0)::int as wins,
            coalesce(o.losses, 0)::int as losses
     from (select $1::int as member_id) target
     left join kill_logs_agg kl on kl.member_id = target.member_id
     left join kills_ops_agg ko on ko.member_id = target.member_id
     left join ops_agg o on o.member_id = target.member_id
     left join deliveries_agg d on d.member_id = target.member_id
     left join sales_agg s on s.member_id = target.member_id
     left join orders_agg ord on ord.member_id = target.member_id`,
    [memberId],
  ).catch((err) => {
    logger.error("computeMemberStats_failed", { error: err instanceof Error ? err.message : String(err), memberId });
    return null;
  });

  return {
    kills: nonNegativeInt(row?.kills),
    deaths: nonNegativeInt(row?.deaths),
    saidas: nonNegativeInt(row?.saidas),
    deliveries: nonNegativeInt(row?.deliveries),
    sales: nonNegativeInt(row?.sales),
    orders: nonNegativeInt(row?.orders),
    wins: nonNegativeInt(row?.wins),
    losses: nonNegativeInt(row?.losses),
  };
}

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MemberRow[]> => {
    try {
      const me = await resolveCurrentMember(context.supabase, context.userId);
      const visibleTiers = visibleMemberTiersFor(me);
      const rows = await pgQuery<MemberRow>(
        `select ${memberSelect(me?.is_manager ?? false)}
         from members m
         where ${visibleMemberWhere(me?.is_manager ?? false)}
         order by ${MEMBER_ORDER}
         limit 500`,
        [visibleTiers],
      );
      return rows;
    } catch (err) {
      logger.error("listMembers_failed", { error: err instanceof Error ? err.message : String(err) });
      throw new Error(err instanceof Error ? err.message : "DB error");
    }
  });

export const listManagers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MemberRow[]> => {
    try {
      const me = await resolveCurrentMember(context.supabase, context.userId);
      const rows = await pgQuery<MemberRow>(
        `select ${memberSelect(me?.is_manager ?? false)}
         from members m
         where ${ACTIVE_MEMBER_WHERE}
           and m.tier = any($2::text[])
         order by ${MEMBER_ORDER}
         limit 200`,
        [ACTIVE_ORG_TIER_LIST, RESPONSIBLE_TIER_LIST],
      );
      return rows;
    } catch (err) {
      logger.error("listManagers_failed", { error: err instanceof Error ? err.message : String(err) });
      throw new Error(err instanceof Error ? err.message : "DB error");
    }
  });

export const listMembersWithStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MemberWithStats[]> => {
    try {
      const me = await resolveCurrentMember(context.supabase, context.userId);
      const visibleTiers = visibleMemberTiersFor(me);
      const rows = await pgQuery<MemberWithStats>(
        `with ${STATS_AGG_CTES}
         select ${memberSelect(me?.is_manager ?? false)},
                (coalesce(kl.kills, 0) + coalesce(ko.kills, 0))::int as kills,
                coalesce(o.deaths, 0)::int as deaths,
                coalesce(o.saidas, 0)::int as saidas,
                coalesce(d.deliveries, 0)::int as deliveries,
                coalesce(s.sales, 0)::int as sales
         from members m
         left join kill_logs_agg kl on kl.member_id = m.id
         left join kills_ops_agg ko on ko.member_id = m.id
         left join ops_agg o on o.member_id = m.id
         left join deliveries_agg d on d.member_id = m.id
         left join sales_agg s on s.member_id = m.id
         where ${visibleMemberWhere(me?.is_manager ?? false)}
         order by ${MEMBER_ORDER}
         limit 500`,
        [visibleTiers],
      );
      return rows.map((row) => ({
        ...row,
        kills: nonNegativeInt(row.kills),
        deaths: nonNegativeInt(row.deaths),
        saidas: nonNegativeInt(row.saidas),
        deliveries: nonNegativeInt(row.deliveries),
        sales: nonNegativeInt(row.sales),
      }));
    } catch (err) {
      logger.error("listMembersWithStats_failed", { error: err instanceof Error ? err.message : String(err) });
      throw new Error(err instanceof Error ? err.message : "DB error");
    }
  });

export const getMember = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => {
    const id = Number(d.id);
    if (!Number.isFinite(id) || id <= 0) throw new Error("id inválido");
    return { id };
  })
  .handler(async ({ data, context }): Promise<MemberDetail> => {
    try {
      const me = await resolveCurrentMember(context.supabase, context.userId);
      const visibleTiers = visibleMemberTiersFor(me);
      const member = await pgOne<MemberRow>(
        `select ${memberSelect(me?.is_manager ?? false)}
         from members m
         where m.id = $2 and ${visibleMemberWhere(me?.is_manager ?? false)}`,
        [visibleTiers, data.id],
      );
      if (!member) return emptyMemberDetail();

      const [contrib, movs, stats] = await Promise.all([
        pgQuery<{ type: string; total: string }>(
          `select movement_type as type, sum(quantity)::text as total
           from inventory_movements
           where member_id = $1
           group by movement_type
           order by abs(sum(quantity)) desc`,
          [data.id],
        ),
        pgQuery<MemberDetail["recentMovements"][number]>(
          `select im.id, im.movement_type as type, im.item_id, i.name as item_name, im.quantity as qty, im.created_at
           from inventory_movements im
           left join items i on i.id = im.item_id
           where im.member_id = $1
           order by im.created_at desc
           limit 20`,
          [data.id],
        ),
        computeMemberStats(data.id),
      ]);

      return {
        member,
        contributions: contrib.map((r) => ({ type: r.type, total: Number(r.total) })),
        recentMovements: movs,
        kills: stats.kills,
        deaths: stats.deaths,
        saidas: stats.saidas,
        deliveries: stats.deliveries,
        vendas: stats.sales,
        orders: stats.orders,
      };
    } catch (err) {
      logger.error("getMember_failed", { error: err instanceof Error ? err.message : String(err), memberId: data.id });
      throw new Error(err instanceof Error ? err.message : "DB error");
    }
  });

export const getMyAllTimeStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{
    kills: number;
    deaths: number;
    saidas: number;
    deliveries: number;
    sales: number;
    orders: number;
    wins: number;
    losses: number;
    kd: string;
    winRate: string;
  }> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me) throw new Error("Membro não encontrado");
    const stats = await computeMemberStats(me.id);
    return {
      kills: stats.kills,
      deaths: stats.deaths,
      saidas: stats.saidas,
      deliveries: stats.deliveries,
      sales: stats.sales,
      orders: stats.orders,
      wins: stats.wins,
      losses: stats.losses,
      kd: stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(2) : stats.kills.toFixed(0),
      winRate: stats.saidas > 0 ? ((stats.wins / stats.saidas) * 100).toFixed(0) : "0",
    };
  });

export const updateMemberNick = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number; nick: string }) => ({ id: IdSchema.parse(d.id), nick: NicknameSchema.parse(d.nick) }))
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Sem permissão");
    await pgQuery(`update members set nickname=$2, updated_at=now(), updated_by=$3 where id=$1`, [data.id, data.nick, `web:${context.userId}`]);
    return { ok: true };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { display_name?: string; nickname?: string | null }) => {
    const name = d.display_name?.trim();
    if (!name || name.length < 1 || name.length > 80) throw new Error("Nome inválido");
    const nickname = NicknameSchema.parse(d.nickname);
    return { display_name: name, nickname };
  })
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me) throw new Error("Membro não encontrado");
    await pgQuery(
      `update members set display_name = $2, nickname = $3, updated_at = now() where id = $1`,
      [me.id, data.display_name, data.nickname],
    );
    if (me.discord_id) {
      await notifyBot({ action: "rename", discord_id: me.discord_id, new_name: data.display_name });
    }
    return { ok: true };
  });
