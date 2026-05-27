import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgOne } from "./pg.server";

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
