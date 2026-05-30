import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgOne } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import { isAdminTier, isSuperAdminTier } from "./config.loader";

export const checkMemberAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profile = await context.supabase
      .from("profiles")
      .select("discord_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    
    if (!profile.data?.discord_id) {
      return { allowed: false, reason: "no_discord" };
    }
    
    const member = await pgOne<{
      id: number;
      status: string | null;
      lifecycle_state: string | null;
      deleted_at: string | null;
    }>(
      `select id, status, lifecycle_state, deleted_at 
       from members 
       where discord_id = $1 and deleted_at is null
       order by id desc
       limit 1`,
      [profile.data.discord_id],
    );
    
    if (!member) {
      return { allowed: false, reason: "not_member" };
    }
    
    if (member.deleted_at != null) {
      return { allowed: false, reason: "deleted" };
    }
    
    const isActive = 
      member.status === "ativo" || 
      member.status == null ||
      member.lifecycle_state === "active" ||
      member.lifecycle_state === "promoted";
    
    if (!isActive) {
      return { allowed: false, reason: "inactive" };
    }
    
    return { allowed: true };
  });

export const checkManagerAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me) return { allowed: false, reason: "not_member" };
    if (!me.is_manager) return { allowed: false, reason: "not_manager" };
    return { allowed: true };
  });

// Apenas Kingpin e Manda-Chuva (chefia total)
export const checkChefiaAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me) return { allowed: false, reason: "not_member" };
    const isChefia = isAdminTier(me.tier) || me.role_label === "kingpin" || me.role_label === "manda_chuva";
    if (!isChefia) return { allowed: false, reason: "not_chefia" };
    return { allowed: true };
  });
