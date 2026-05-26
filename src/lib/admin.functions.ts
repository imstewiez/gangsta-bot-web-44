import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveCurrentMember } from "./pricing.server";

export async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r) => r.role);
  if (!roles.includes("admin") && !roles.includes("superadmin")) {
    throw new Error("Forbidden: admin only");
  }
}

export async function assertSuperAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  if (!(data ?? []).some((r) => r.role === "superadmin")) {
    throw new Error("Forbidden: superadmin only");
  }
}

export const checkSuperAdminAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const roles = (data ?? []).map((r) => r.role);
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
    const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] =
      await Promise.all([
        supabaseAdmin
          .from("profiles")
          .select("user_id, display_name, discord_id, avatar_url, created_at"),
        supabaseAdmin.from("user_roles").select("user_id, role"),
      ]);
    if (pErr) throw new Error(pErr.message);
    if (rErr) throw new Error(rErr.message);
    const rolesByUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    }
    return (profiles ?? []).map((p) => ({
      user_id: p.user_id,
      display_name: p.display_name,
      discord_id: p.discord_id,
      avatar_url: p.avatar_url,
      created_at: p.created_at,
      roles: rolesByUser.get(p.user_id) ?? [],
    }));
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { user_id: string; role: "superadmin" | "admin" | "member"; grant: boolean }) => {
      if (!["superadmin", "admin", "member"].includes(d.role))
        throw new Error("Role inválido");
      return d;
    },
  )
  .handler(async ({ data, context }) => {
    const callerRoles = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .then((r) => (r.data ?? []).map((x) => x.role));
    const isCallerSuper = callerRoles.includes("superadmin");
    const isCallerAdmin = callerRoles.includes("admin") || isCallerSuper;

    if (!isCallerAdmin) throw new Error("Forbidden: admin only");

    // Target's current roles
    const targetRoles = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user_id)
      .then((r) => (r.data ?? []).map((x) => x.role));
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
          { user_id: data.user_id, role: data.role },
          { onConflict: "user_id,role" },
        );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.user_id)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });
