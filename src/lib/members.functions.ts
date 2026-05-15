import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";

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
  .handler(async (): Promise<MemberRow[]> => {
    try {
      return await pgQuery<MemberRow>(
        `select ${SELECT_MEMBER}
         from members
         where deleted_at is null
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
    } catch (err) {
      console.error("[listMembers] failed:", err);
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
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data }): Promise<MemberDetail> => {
    const member = await pgOne<MemberRow>(
      `select ${SELECT_MEMBER} from members where id = $1`,
      [data.id],
    );
    if (!member)
      return { member: null, contributions: [], recentMovements: [], kills: 0, deaths: 0, saidas: 0, deliveries: 0, vendas: 0, orders: 0 };
    const [contrib, movs, kills, deaths, saidas, deliveries, vendas, orders] = await Promise.all([
      pgQuery<{ type: string; total: string }>(
        `select movement_type as type, sum(quantity)::text as total
         from inventory_movements
         where member_id = $1
         group by movement_type order by sum(quantity) desc`,
        [data.id],
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
        [data.id],
      ),
      pgOne<{ count: string }>(
        "select count(*)::text as count from kill_logs where killer_id = $1",
        [data.id],
      ).catch(() => ({ count: "0" })),
      pgOne<{ count: string }>(
        "select count(*)::text as count from kill_logs where victim_id = $1",
        [data.id],
      ).catch(() => ({ count: "0" })),
      pgOne<{ count: string }>(
        "select count(*)::text as count from operation_participants where member_id = $1",
        [data.id],
      ).catch(() => ({ count: "0" })),
      pgOne<{ count: string }>(
        "select count(*)::text as count from deliveries where requester_member_id = $1 and status = 'approved' and tipo = 'entrega'",
        [data.id],
      ).catch(() => ({ count: "0" })),
      pgOne<{ count: string }>(
        "select count(*)::text as count from deliveries where requester_member_id = $1 and status = 'approved' and tipo = 'venda'",
        [data.id],
      ).catch(() => ({ count: "0" })),
      pgOne<{ count: string }>(
        "select count(*)::text as count from orders where member_id = $1",
        [data.id],
      ).catch(() => ({ count: "0" })),
    ]);
    return {
      member,
      contributions: contrib.map((r) => ({
        type: r.type,
        total: Number(r.total),
      })),
      recentMovements: movs,
      kills: Number(kills?.count ?? 0),
      deaths: Number(deaths?.count ?? 0),
      saidas: Number(saidas?.count ?? 0),
      deliveries: Number(deliveries?.count ?? 0),
      vendas: Number(vendas?.count ?? 0),
      orders: Number(orders?.count ?? 0),
    };
  });
