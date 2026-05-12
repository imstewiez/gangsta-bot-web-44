// Server-only helpers (touch DB). Must NEVER be imported from client code.
import { pgOne } from "./pg.server";
import {
  isManager,
  canSeeInventory,
  type CurrentMember,
} from "./pricing.shared";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export async function resolveCurrentMember(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<CurrentMember | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("discord_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile?.discord_id) return null;
  const m = await pgOne<{
    id: number;
    discord_id: string | null;
    display_name: string | null;
    tier: string | null;
    role_label: string | null;
  }>(
    `select id, discord_id, display_name, tier, coalesce(role,'bairrista') as role_label
     from members where discord_id = $1 and deleted_at is null limit 1`,
    [profile.discord_id],
  );
  if (!m) return null;
  return {
    ...m,
    is_manager: isManager(m),
    can_see_inventory: canSeeInventory(m),
  };
}
