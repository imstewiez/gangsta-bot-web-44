// Server-only helpers (touch DB). Must NEVER be imported from client code.
import { getRequest } from "@tanstack/react-start/server";
import { pgOne } from "./pg.server";
import { syncExpiredMemberAbsences } from "./member-absence.server";
import {
  isSuperAdmin,
  isAdmin,
  isManager,
  canSeeInventory,
  canManagePrizes,
  type CurrentMember,
} from "./pricing.shared";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type MemberRecord = {
  id: number;
  discord_id: string | null;
  display_name: string | null;
  tier: string | null;
  role_label: string | null;
};

const ACTIVE_MEMBER_SQL = `
  deleted_at is null
  and coalesce(lifecycle_state::text, status, 'active') in ('active','ativo','promoted')
`;

function decorateMember(member: MemberRecord, viewAs?: { actual_member_id: number; actual_display_name: string | null }): CurrentMember {
  return {
    ...member,
    is_superadmin: isSuperAdmin(member),
    is_admin: isAdmin(member),
    is_manager: isManager(member),
    can_see_inventory: canSeeInventory(member),
    can_manage_prizes: canManagePrizes(member),
    is_morador: member.role_label === "bairrista",
    is_viewing_as: Boolean(viewAs),
    actual_member_id: viewAs?.actual_member_id ?? null,
    actual_display_name: viewAs?.actual_display_name ?? null,
  };
}

async function getMemberByDiscord(discordId: string): Promise<MemberRecord | null> {
  return pgOne<MemberRecord>(
    `select id, discord_id, display_name, tier, coalesce(role,'bairrista') as role_label
     from members
     where discord_id = $1
       and ${ACTIVE_MEMBER_SQL}
     limit 1`,
    [discordId],
  );
}

async function getMemberById(memberId: number): Promise<MemberRecord | null> {
  return pgOne<MemberRecord>(
    `select id, discord_id, display_name, tier, coalesce(role,'bairrista') as role_label
     from members
     where id = $1
       and ${ACTIVE_MEMBER_SQL}
     limit 1`,
    [memberId],
  );
}

export async function resolveActualMember(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<CurrentMember | null> {
  await syncExpiredMemberAbsences();
  const { data: profile } = await supabase
    .from("profiles")
    .select("discord_id, display_name")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile?.discord_id) return null;
  const member = await getMemberByDiscord(profile.discord_id);
  return member ? decorateMember(member) : null;
}

export async function resolveCurrentMember(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<CurrentMember | null> {
  const actual = await resolveActualMember(supabase, userId);
  if (!actual) return null;

  const rawViewAs = getRequest()?.headers.get("x-view-as-member-id")?.trim();
  const viewAsId = rawViewAs ? Number(rawViewAs) : null;
  if (!viewAsId || !Number.isFinite(viewAsId) || viewAsId <= 0 || viewAsId === actual.id) return actual;

  if (!actual.is_superadmin) return actual;

  const target = await getMemberById(viewAsId);
  if (!target) return actual;

  return decorateMember(target, { actual_member_id: actual.id, actual_display_name: actual.display_name });
}
