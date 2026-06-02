import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import { IdSchema, NicknameSchema } from "./security";
import { logger } from "./logger.server";
import { notifyBot } from "./discord.server";

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

const ACTIVE_ORG_TIERS = new Set([
  "young_blood",
  "o_gunao",
  "gangster_fodido",
  "patrao_di_zona",
  "real_gangster",
  "og",
  "kingpin",
  "manda_chuva",
]);

const ACTIVE_MEMBER_WHERE = `
  m.deleted_at is null
  and coalesce(m.lifecycle_state::text, m.status, 'active') in ('active','ativo','promoted')
  and m.tier = any($1::text[])
`;

const ACTIVE_ORG_TIER_LIST = [...ACTIVE_ORG_TIERS];

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
      const rows = await pgQuery<MemberRow>(
        `select ${memberSelect(me?.is_manager ?? false)}
         from members m
         where ${ACTIVE_MEMBER_WHERE}
         order by ${MEMBER_ORDER}
         limit 500`,
        [ACTIVE_ORG_TIER_LIST],
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
           and m.tier in ('patrao_di_zona', 'real_gangster', 'og', 'kingpin', 'manda_chuva')
         order by ${MEMBER_ORDER}
         limit 200`,
        [ACTIVE_ORG_TIER_LIST],
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
        [ACTIVE_ORG_TIER_LIST],
      );
      return rows;
    } catch (err) {
      logger.error("listMembersWithStats_failed", { error: err instanceof Error ? err.message : String(err) });
      throw new Error(err instanceof Error ? err.message : "DB error");
    }
  });

export const getMember = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const parsed = IdSchema.safeParse((data as { id?: unknown })?.id ?? data);
    if (!parsed.success) throw new Error("ID inválido");
    return { id: parsed.data };
  })
  .handler(async ({ data, context }): Promise<MemberDetail> => {
    try {
      const me = await resolveCurrentMember(context.supabase, context.userId);
      const members = await pgQuery<MemberRow>(
        `select ${memberSelect(me?.is_manager ?? false)}
         from members m where m.id = $2 and ${ACTIVE_MEMBER_WHERE}`,
        [ACTIVE_ORG_TIER_LIST, data.id],
      );
      const member = members[0] ?? null;
      const contributions = await pgQuery<{ type: string; total: string }>(
        `select movement_type as type, coalesce(sum(abs(quantity)),0)::text as total
         from inventory_movements
         where member_id=$1 group by movement_type order by 2 desc limit 10`,
        [data.id],
      );
      const recentMovements = await pgQuery<MemberDetail["recentMovements"][number]>(
        `select im.id, im.movement_type as type, im.item_id, i.name as item_name, im.quantity::float as qty, im.created_at::text
         from inventory_movements im left join items i on i.id=im.item_id
         where im.member_id=$1 order by im.created_at desc limit 20`,
        [data.id],
      );
      const stats = await pgOne<{ kills: string; deaths: string; saidas: string; deliveries: string; vendas: string; orders: string }>(
        `select coalesce(ats.kills_total,0)::text as kills,
                coalesce(ats.deaths_total,0)::text as deaths,
                coalesce(ats.saidas_total,0)::text as saidas,
                coalesce(ats.deliveries,0)::text as deliveries,
                coalesce(ats.sales,0)::text as vendas,
                coalesce(ats.orders,0)::text as orders
         from all_time_stats ats where ats.member_id=$1`,
        [data.id],
      );
      return {
        member,
        contributions: contributions.map((c) => ({ type: c.type, total: Number(c.total) })),
        recentMovements,
        kills: Number(stats?.kills ?? 0),
        deaths: Number(stats?.deaths ?? 0),
        saidas: Number(stats?.saidas ?? 0),
        deliveries: Number(stats?.deliveries ?? 0),
        vendas: Number(stats?.vendas ?? 0),
        orders: Number(stats?.orders ?? 0),
      };
    } catch (err) {
      logger.error("getMember_failed", { error: err instanceof Error ? err.message : String(err), id: data.id });
      throw new Error(err instanceof Error ? err.message : "DB error");
    }
  });

export const renameSelf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    const parsed = NicknameSchema.safeParse((data as { nickname?: unknown })?.nickname);
    if (!parsed.success) throw new Error("Alcunha inválida");
    return { nickname: parsed.data };
  })
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me) throw new Error("Membro não encontrado");
    await pgQuery("update members set nickname=$2, updated_at=now() where id=$1", [me.id, data.nickname]);
    if (me.discord_id) await notifyBot({ action: "rename", discord_id: me.discord_id, new_name: data.nickname });
    return { ok: true };
  });
