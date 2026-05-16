import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
    return {
      profile: (p as Profile) ?? null,
      roles: (r ?? []).map((x: { role: string }) => x.role),
    };
  });
