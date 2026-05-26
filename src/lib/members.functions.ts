import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import { IdSchema } from "./security";
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

const SELECT_MEMBER = `
  id, discord_id, display_name,
  nickname as nick, tier,
  coalesce(role,'bairrista') as role_label,
  joined_at,
  coalesce(lifecycle_state::text, status, 'active') as status_lifecycle
`;

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MemberRow[]> => {
    try {
      const me = await resolveCurrentMember(context.supabase, context.userId);
      const isManager = me?.is_manager ?? false;
      const rows = await pgQuery<MemberRow>(
        `select id, ${isManager ? 'discord_id' : 'null as discord_id'}, display_name, nickname as nick, tier, coalesce(role,'bairrista') as role_label, joined_at, status as status_lifecycle
         from members
         where deleted_at is null
           and (status = 'ativo' or status is null)
         order by
           case coalesce(role,'bairrista')
             when 'manda_chuva' then 1
             when 'kingpin' then 2
             when 'og' then 3
             when 'real_gangster' then 4
             when 'patrao_di_zona' then 5
             else 6 end,
           case tier when 'gangster_fodido' then 1 when 'o_gunao' then 2 when 'young_blood' then 3 else 4 end,
           display_name nulls last
         limit 500`,
      );
      return rows;
    } catch (err) {
      console.error("[listMembers] failed:", err);
      throw new Error(err instanceof Error ? err.message : "DB error");
    }
  });

export const listManagers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MemberRow[]> => {
    try {
      const me = await resolveCurrentMember(context.supabase, context.userId);
      const isManager = me?.is_manager ?? false;
      const rows = await pgQuery<MemberRow>(
        `select id, ${isManager ? 'discord_id' : 'null as discord_id'}, display_name, nickname as nick, tier, coalesce(role,'bairrista') as role_label, joined_at, status as status_lifecycle
         from members
         where deleted_at is null
           and (status = 'ativo' or status is null)
           and tier in ('patrao_di_zona', 'kingpin', 'manda_chuva')
         order by
           case coalesce(role,'bairrista')
             when 'manda_chuva' then 1
             when 'kingpin' then 2
             when 'og' then 3
             when 'real_gangster' then 4
             when 'patrao_di_zona' then 5
             else 6 end,
           display_name nulls last
         limit 200`,
      );
      return rows;
    } catch (err) {
      console.error("[listManagers] failed:", err);
      throw new Error(err instanceof Error ? err.message : "DB error");
    }
  });

export type MemberWithStats = MemberRow & {
  kills: number;
  deaths: number;
  saidas: number;
  deliveries: number;
  sales: number;
};

export const listMembersWithStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MemberWithStats[]> => {
    try {
      const me = await resolveCurrentMember(context.supabase, context.userId);
      const isManager = me?.is_manager ?? false;
      const rows = await pgQuery<MemberWithStats>(
        `select m.id, ${isManager ? 'm.discord_id' : 'null as discord_id'}, m.display_name, m.nickname as nick, m.tier, coalesce(m.role,'bairrista') as role_label, m.joined_at, m.status as status_lifecycle,
                coalesce(ats.kills_total,0)::int as kills,
                coalesce(ats.deaths_total,0)::int as deaths,
                coalesce(ats.saidas_total,0)::int as saidas,
                coalesce(ats.deliveries,0)::int as deliveries,
                coalesce(ats.sales,0)::int as sales
         from members m
         left join all_time_stats ats on ats.member_id = m.id
         where m.deleted_at is null
           and (m.status = 'ativo' or m.status is null)
         order by
           case coalesce(m.role,'bairrista')
             when 'manda_chuva' then 1
             when 'kingpin' then 2
             when 'og' then 3
             when 'real_gangster' then 4
             when 'patrao_di_zona' then 5
             else 6 end,
           case m.tier when 'gangster_fodido' then 1 when 'o_gunao' then 2 when 'young_blood' then 3 else 4 end,
           m.display_name nulls last
         limit 500`,
      );
      return rows;
    } catch (err) {
      console.error("[listMembersWithStats] failed:", err);
      throw new Error(err instanceof Error ? err.message : "DB error");
    }
  });

export type MemberDetail = {
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

export const getMember = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => {
    const id = Number(d.id);
    if (!Number.isFinite(id) || id <= 0) throw new Error("id inválido");
    return { id };
  })
  .handler(async ({ data, context }): Promise<MemberDetail> => {
    try {
    const id = data.id;
    const me = await resolveCurrentMember(context.supabase, context.userId);
    const isManager = me?.is_manager ?? false;
    const member = await pgOne<MemberRow>(
      `select id, ${isManager ? 'discord_id' : 'null as discord_id'}, display_name, nickname as nick, tier, coalesce(role,'bairrista') as role_label, joined_at, status as status_lifecycle from members where id = $1`,
      [id],
    );
    if (!member)
      return { member: null, contributions: [], recentMovements: [], kills: 0, deaths: 0, saidas: 0, deliveries: 0, vendas: 0, orders: 0 };
    const [contrib, movs, statsRow] = await Promise.all([
      pgQuery<{ type: string; total: string }>(
        `select movement_type as type, sum(quantity)::text as total
         from inventory_movements
         where member_id = $1
         group by movement_type order by sum(quantity) desc`,
        [id],
      ),
      pgQuery<{
        id: number;
        type: string;
        item_id: number | null;
        item_name: string | null;
        qty: number;
        created_at: string;
      }>(
        `select im.id, im.movement_type as type, im.item_id, i.name as item_name,
                im.quantity as qty, im.created_at
         from inventory_movements im
         left join items i on i.id = im.item_id
         where im.member_id = $1
         order by im.created_at desc
         limit 25`,
        [id],
      ),
      pgOne<{
        kills_total: number;
        deaths_total: number;
        saidas_total: number;
        deliveries: number;
        sales: number;
        orders: number;
      }>(
        `select
          coalesce((select count(*)::int from kill_logs where killer_id = $1), 0)
          + coalesce((select sum(kills)::int from operation_participants where member_id = $1), 0) as kills_total,
          coalesce((select sum(deaths_count)::int from operation_participants where member_id = $1), 0) as deaths_total,
          coalesce((select count(distinct operation_id)::int from operation_participants where member_id = $1), 0) as saidas_total,
          coalesce((select count(*)::int from inventory_movements where member_id = $1 and movement_type = 'entrega_bairrista'), 0) as deliveries,
          coalesce((select count(*)::int from inventory_movements where member_id = $1 and movement_type = 'venda_bairrista'), 0) as sales,
          coalesce((select count(*)::int from orders where member_id = $1), 0) as orders`,
        [id],
      ),
    ]);
    return {
      member,
      contributions: contrib.map((r) => ({
        type: r.type,
        total: Number(r.total),
      })),
      recentMovements: movs,
      kills: statsRow?.kills_total ?? 0,
      deaths: statsRow?.deaths_total ?? 0,
      saidas: statsRow?.saidas_total ?? 0,
      deliveries: statsRow?.deliveries ?? 0,
      vendas: statsRow?.sales ?? 0,
      orders: statsRow?.orders ?? 0,
    };
    } catch (e: any) {
      throw new Error(e?.message ?? "Erro ao carregar perfil do membro");
    }
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { display_name?: string; nickname?: string | null }) => {
    const name = d.display_name?.trim();
    if (!name || name.length < 1 || name.length > 80) throw new Error("Nome inválido");
    return { display_name: name, nickname: d.nickname?.trim() ?? null };
  })
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me) throw new Error("Membro não encontrado");
    await pgQuery(
      `update members set display_name = $2, nickname = $3, updated_at = now() where id = $1`,
      [me.id, data.display_name, data.nickname],
    );
    if (me.discord_id) {
      await notifyBot({
        action: "rename",
        discord_id: me.discord_id,
        new_name: data.display_name,
      });
    }
    return { ok: true };
  });

