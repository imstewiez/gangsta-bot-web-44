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

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MemberRow[]> => {
    try {
      const me = await resolveCurrentMember(context.supabase, context.userId);
      const visibleTiers = visibleMemberTiersFor(me);
      const rows = await pgQuery<MemberRow>(
        `select ${memberSelect(me?.is_manager ?? false)}
         from members m
         where ${ACTIVE_MEMBER_WHERE}
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
        `select ${memberSelect(me?.is_manager ?? false)},
                coalesce(ats.kills_total,0)::int as kills,
                coalesce(ats.deaths_total,0)::int as deaths,
                coalesce(ats.saidas_total,0)::int as saidas,
                coalesce(ats.deliveries,0)::int as deliveries,
                coalesce(ats.sales,0)::int as sales
         from members m
         left join all_time_stats ats on ats.member_id = m.id
         where ${ACTIVE_MEMBER_WHERE}
         order by ${MEMBER_ORDER}
         limit 500`,
        [visibleTiers],
      );
      return rows;
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
         where m.id = $2 and ${ACTIVE_MEMBER_WHERE}`,
        [visibleTiers, data.id],
      );
      if (!member) return emptyMemberDetail();

      const [contrib, movs, statsRow] = await Promise.all([
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
        pgOne<{ kills: number; deaths: number; saidas: number; deliveries: number; vendas: number; orders: number }>(
          `select coalesce(ats.kills_total,0)::int as kills,
                  coalesce(ats.deaths_total,0)::int as deaths,
                  coalesce(ats.saidas_total,0)::int as saidas,
                  coalesce(ats.deliveries,0)::int as deliveries,
                  coalesce(ats.sales,0)::int as vendas,
                  (select count(*)::int from orders o where o.member_id = $1) as orders
           from members m
           left join all_time_stats ats on ats.member_id = m.id
           where m.id = $1`,
          [data.id],
        ),
      ]);

      return {
        member,
        contributions: contrib.map((r) => ({ type: r.type, total: Number(r.total) })),
        recentMovements: movs,
        kills: Number(statsRow?.kills ?? 0),
        deaths: Number(statsRow?.deaths ?? 0),
        saidas: Number(statsRow?.saidas ?? 0),
        deliveries: Number(statsRow?.deliveries ?? 0),
        vendas: Number(statsRow?.vendas ?? 0),
        orders: Number(statsRow?.orders ?? 0),
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
    const row = await pgOne<{
      kills_total: number;
      deaths_total: number;
      saidas_total: number;
      deliveries: number;
      sales: number;
      orders: number;
      wins: number;
      losses: number;
    }>(
      `select coalesce(kills_total,0)::int as kills_total,
              coalesce(deaths_total,0)::int as deaths_total,
              coalesce(saidas_total,0)::int as saidas_total,
              coalesce(deliveries,0)::int as deliveries,
              coalesce(sales,0)::int as sales,
              coalesce(orders,0)::int as orders,
              coalesce(wins,0)::int as wins,
              coalesce(losses,0)::int as losses
       from all_time_stats
       where member_id = $1`,
      [me.id],
    );
    const kills = row?.kills_total ?? 0;
    const deaths = row?.deaths_total ?? 0;
    const wins = row?.wins ?? 0;
    const saidas = row?.saidas_total ?? 0;
    return {
      kills,
      deaths,
      saidas,
      deliveries: row?.deliveries ?? 0,
      sales: row?.sales ?? 0,
      orders: row?.orders ?? 0,
      wins,
      losses: row?.losses ?? 0,
      kd: deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(0),
      winRate: saidas > 0 ? ((wins / saidas) * 100).toFixed(0) : "0",
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
