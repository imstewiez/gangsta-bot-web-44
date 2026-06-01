import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgOne } from "./pg.server";

export const ensureMemberFromProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profile = await context.supabase
      .from("profiles")
      .select("discord_id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!profile.data?.discord_id) {
      return { created: false, reason: "no_discord" };
    }

    const existing = await pgOne<{ id: number; deleted_at: string | null }>(
      `select id, deleted_at
       from members
       where discord_id = $1
       order by id desc
       limit 1`,
      [profile.data.discord_id],
    );

    if (existing?.deleted_at != null) {
      return { created: false, reason: "was_kicked" };
    }
    if (existing) {
      return { created: false, reason: "already_exists" };
    }

    // A webapp não fala com Discord nem cria membros automaticamente.
    // Membership é sincronizada pelo bot via eventos Discord, para evitar divergência de roles/tags.
    return { created: false, reason: "not_member" };
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

    // Include implicit roles from active member tier only.
    if (p?.discord_id) {
      const member = await pgOne<{
        tier: string | null;
        role: string | null;
      }>(
        `select tier, role
         from members
         where discord_id = $1
           and deleted_at is null
           and coalesce(lifecycle_state::text, status, 'active') in ('active','ativo','promoted')
         limit 1`,
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
