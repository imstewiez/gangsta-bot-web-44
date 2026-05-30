import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgOne, pgQuery } from "./pg.server";
import { fetchGuildMember, detectMemberRole, pickDisplayName } from "./discord-api.server";
import { logger } from "./logger.server";

export const ensureMemberFromProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profile = await context.supabase
      .from("profiles")
      .select("discord_id, display_name")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!profile.data?.discord_id) {
      return { created: false, reason: "no_discord" };
    }

    const existing = await pgOne<{ id: number; deleted_at: string | null }>(
      `select id, deleted_at from members where discord_id = $1 order by id desc limit 1`,
      [profile.data.discord_id],
    );

    if (existing) {
      if (existing.deleted_at != null) {
        return { created: false, reason: "was_kicked" };
      }
      return { created: false, reason: "already_exists" };
    }

    // Tentar criar automaticamente a partir do Discord se tiver role RP
    try {
      const gm = await fetchGuildMember(profile.data.discord_id);
      if (!gm) {
        return { created: false, reason: "not_in_guild" };
      }

      const detected = detectMemberRole(gm.roles);
      if (!detected) {
        return { created: false, reason: "no_rp_role" };
      }

      const displayName = pickDisplayName(gm);
      const username = gm.user.username;

      const inserted = await pgOne<{ id: number }>(
        `insert into members
          (discord_id, username, display_name, role, tier, status, joined_at, lifecycle_state, created_at, updated_at)
         values ($1, $2, $3, $4, $5, 'ativo', now(), 'active', now(), now())
         returning id`,
        [profile.data.discord_id, username, displayName, detected.role, detected.tier || "young_blood"],
      );

      logger.info("member_auto_created", {
        discord_id: profile.data.discord_id,
        display_name: displayName,
        role: detected.role,
        tier: detected.tier,
      });

      return { created: true, reason: "auto_created", member_id: inserted?.id ?? null };
    } catch (e: any) {
      // Se não conseguir contactar Discord (token não configurado, etc.), falha gracefully
      logger.warn("member_auto_create_failed", {
        discord_id: profile.data.discord_id,
        error: e instanceof Error ? e.message : String(e),
      });
      return { created: false, reason: "not_member" };
    }
  });

export type Profile = {
  user_id: string;
  display_name: string | null;
  discord_id: string | null;
  avatar_url: string | null;
};

export const getAuthProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ profile: Profile | null; roles: string[] }> => {
    const uid = context.userId;
    const [{ data: p }, { data: r }] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("user_id,display_name,discord_id,avatar_url")
        .eq("user_id", uid)
        .maybeSingle(),
      context.supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    const roles = new Set((r ?? []).map((x: { role: string }) => x.role));

    // Include implicit roles from member tier
    if (p?.discord_id) {
      const member = await pgOne<{
        tier: string | null;
        role: string | null;
      }>(
        `select tier, role from members where discord_id = $1 and deleted_at is null limit 1`,
        [p.discord_id],
      );
      const tier = member?.tier ?? null;
      const roleLabel = member?.role ?? null;
      if (tier === "manda_chuva" || roleLabel === "manda_chuva") {
        roles.add("superadmin");
        roles.add("admin");
      }
      if (tier === "kingpin" || roleLabel === "kingpin" || roleLabel === "chefia") {
        roles.add("admin");
      }
    }

    return {
      profile: (p as Profile) ?? null,
      roles: Array.from(roles),
    };
  });
