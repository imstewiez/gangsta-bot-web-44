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

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<MemberRow[]> => {
    return pgQuery<MemberRow>(
      `select id, discord_id, display_name, nick, tier,
              coalesce(role, 'bairrista') as role_label,
              joined_at,
              status_lifecycle
       from members
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
       limit 500`
    );
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
};

export const getMember = createServerFn({ method: "GET" })
  .inputValidator((d: { id: number }) => d)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data }): Promise<MemberDetail> => {
    const member = await pgOne<MemberRow>(
      `select id, discord_id, display_name, nick, tier,
              coalesce(role,'bairrista') as role_label, joined_at, status_lifecycle
       from members where id = $1`,
      [data.id]
    );
    if (!member) return { member: null, contributions: [], recentMovements: [], kills: 0 };
    const [contrib, movs, kills] = await Promise.all([
      pgQuery<{ type: string; total: string }>(
        `select type, sum(qty)::text as total
         from inventory_movements
         where member_id = $1
         group by type order by sum(qty) desc`,
        [data.id]
      ),
      pgQuery<{
        id: number; type: string; item_id: number | null; item_name: string | null;
        qty: number; created_at: string;
      }>(
        `select im.id, im.type, im.item_id, i.name as item_name, im.qty, im.created_at
         from inventory_movements im
         left join items i on i.id = im.item_id
         where im.member_id = $1
         order by im.created_at desc
         limit 25`,
        [data.id]
      ),
      pgOne<{ count: string }>(
        "select count(*)::text as count from kill_logs where member_id = $1",
        [data.id]
      ).catch(() => ({ count: "0" })),
    ]);
    return {
      member,
      contributions: contrib.map((r) => ({ type: r.type, total: Number(r.total) })),
      recentMovements: movs,
      kills: Number(kills?.count ?? 0),
    };
  });
