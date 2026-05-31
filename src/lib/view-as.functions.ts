import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery } from "./pg.server";
import { resolveActualMember } from "./pricing.server";
import { isAdmin, isManager, isSuperAdmin, canSeeInventory } from "./pricing.shared";

export type ViewAsTarget = {
  id: number;
  display_name: string | null;
  nick: string | null;
  tier: string | null;
  role_label: string | null;
  is_superadmin: boolean;
  is_admin: boolean;
  is_manager: boolean;
  can_see_inventory: boolean;
};

export const listViewAsTargets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ViewAsTarget[]> => {
    const actual = await resolveActualMember(context.supabase, context.userId);
    if (!actual?.is_superadmin) return [];

    const rows = await pgQuery<{
      id: number;
      display_name: string | null;
      nick: string | null;
      tier: string | null;
      role_label: string | null;
    }>(
      `select id, display_name, nickname as nick, tier, coalesce(role,'bairrista') as role_label
       from members
       where deleted_at is null
         and coalesce(lifecycle_state::text, status, 'active') in ('active','ativo','promoted')
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

    return rows.map((member) => ({
      ...member,
      is_superadmin: isSuperAdmin(member),
      is_admin: isAdmin(member),
      is_manager: isManager(member),
      can_see_inventory: canSeeInventory(member),
    }));
  });
