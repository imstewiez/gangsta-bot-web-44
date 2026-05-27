import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgOne } from "./pg.server";

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

    const existing = await pgOne<{ id: number }>(
      `select id from members where discord_id = $1 and deleted_at is null limit 1`,
      [profile.data.discord_id],
    );

    if (existing) {
      return { created: false, reason: "already_exists" };
    }

    const created = await pgOne<{ id: number }>(
      `insert into members (discord_id, username, display_name, role, tier, status, lifecycle_state, joined_at, created_at, updated_at)
       values ($1, $2, $2, 'bairrista', 'young_blood', 'ativo', 'active', now(), now(), now())
       returning id`,
      [profile.data.discord_id, profile.data.display_name ?? "Unknown"],
    );

    return { created: true, member_id: created?.id };
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
