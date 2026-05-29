import { createServerFn } from "@tanstack/react-start";
import { isSuperAdminTier, isAdminTier } from "./config.loader";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { pgOne, pgQuery } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import { z } from "zod";
import { UuidSchema } from "./security";

async function getEffectiveRoles(userId: string): Promise<string[]> {
  const { data: roleRows, error: rErr } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (rErr) throw new Error(rErr.message);
  const roles = new Set(((roleRows ?? []) as { role: string }[]).map((r) => r.role));

  // Also check member tier / role for implicit admin/superadmin
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("discord_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (profile?.discord_id) {
    const member = await pgOne<{
      tier: string | null;
      role: string | null;
    }>(
      `select tier, role from members where discord_id = $1 and deleted_at is null limit 1`,
      [profile.discord_id],
    );
    const tier = member?.tier ?? null;
    const roleLabel = member?.role ?? null;
    if (isSuperAdminTier(tier) || roleLabel === "manda_chuva") {
      roles.add("superadmin");
      roles.add("admin");
    }
    if (isAdminTier(tier) || roleLabel === "kingpin" || roleLabel === "chefia") {
      roles.add("admin");
    }
  }
  return Array.from(roles);
}

export async function assertAdmin(userId: string) {
  const roles = await getEffectiveRoles(userId);
  if (!roles.includes("admin") && !roles.includes("superadmin")) {
    throw new Error("Forbidden: admin only");
  }
}

export async function assertSuperAdmin(userId: string) {
  const roles = await getEffectiveRoles(userId);
  if (!roles.includes("superadmin")) {
    throw new Error("Forbidden: superadmin only");
  }
}

export const checkSuperAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const roles = await getEffectiveRoles(context.userId);
    return {
      allowed: roles.includes("superadmin"),
      is_superadmin: roles.includes("superadmin"),
      is_admin: roles.includes("admin") || roles.includes("superadmin"),
    };
  });

export const listAppUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    // Get all profiles with their implicit roles from member tier
    const rows = await pgQuery<{
      user_id: string;
      display_name: string | null;
      discord_id: string | null;
      avatar_url: string | null;
      created_at: string;
      explicit_roles: string[];
      tier: string | null;
      member_role: string | null;
    }>(
      `SELECT
         p.user_id,
         p.display_name,
         p.discord_id,
         p.avatar_url,
         p.created_at,
         COALESCE(
           (SELECT array_agg(ur.role)::text[] FROM user_roles ur WHERE ur.user_id = p.user_id),
           ARRAY[]::text[]
         ) as explicit_roles,
         m.tier,
         m.role as member_role
       FROM profiles p
       LEFT JOIN members m ON m.discord_id = p.discord_id AND m.deleted_at IS NULL
       ORDER BY p.created_at DESC`
    );

    return rows.map((r) => {
      const roles = new Set(r.explicit_roles ?? []);
      // Add implicit roles from tier
      if (r.tier === "manda_chuva" || r.member_role === "manda_chuva") {
        roles.add("superadmin");
        roles.add("admin");
      }
      if (r.tier === "kingpin" || r.member_role === "kingpin" || r.member_role === "chefia") {
        roles.add("admin");
      }
      return {
        user_id: r.user_id,
        display_name: r.display_name,
        discord_id: r.discord_id,
        avatar_url: r.avatar_url,
        created_at: r.created_at,
        roles: Array.from(roles),
      };
    });
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { user_id: string; role: "superadmin" | "admin" | "member"; grant: boolean }) => {
      return z.object({
        user_id: UuidSchema,
        role: z.enum(["superadmin", "admin", "member"]),
        grant: z.boolean(),
      }).parse(d);
    },
  )
  .handler(async ({ data, context }) => {
    const callerRoles = await getEffectiveRoles(context.userId);
    const isCallerSuper = callerRoles.includes("superadmin");
    const isCallerAdmin = callerRoles.includes("admin") || isCallerSuper;

    if (!isCallerAdmin) throw new Error("Forbidden: admin only");

    // Target's current roles
    const targetRoles = await getEffectiveRoles(data.user_id);
    const isTargetSuper = targetRoles.includes("superadmin");

    // Self-protection: cannot demote yourself
    if (data.user_id === context.userId && !data.grant) {
      if (data.role === "superadmin") {
        throw new Error("Não podes remover-te a ti mesmo como superadmin.");
      }
      if (data.role === "admin" && !isCallerSuper) {
        throw new Error("Não podes remover-te a ti mesmo como admin.");
      }
    }

    // Superadmin rules
    if (data.role === "superadmin") {
      if (!isCallerSuper) {
        throw new Error("Apenas superadmin pode atribuir/remover superadmin.");
      }
      // Superadmin cannot be removed by anyone except another superadmin (already checked above)
      if (!data.grant && isTargetSuper && data.user_id !== context.userId) {
        // OK — superadmin removing another superadmin
      }
    }

    // Admin rules: only superadmin can grant/remove admin on others
    if (data.role === "admin") {
      if (!isCallerSuper) {
        throw new Error("Apenas superadmin pode atribuir/remover admin.");
      }
      // Protect existing superadmins: cannot remove admin from a superadmin
      if (!data.grant && isTargetSuper) {
        throw new Error("Não podes remover admin de um superadmin.");
      }
    }

    // Member role: any admin can grant/remove
    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert(
          { user_id: data.user_id, role: data.role as any },
          { onConflict: "user_id,role" },
        );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.user_id)
        .eq("role", data.role as any);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
