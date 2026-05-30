import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import { notifyBot } from "./discord.server";
import { getTierOrder, isAdminTier, isSuperAdminTier } from "./config.loader";
import { logAdminAction } from "./logging.functions";

const TIERS = getTierOrder();

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function assertManager(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const me = await resolveCurrentMember(supabase, userId);
  if (!me?.is_manager) throw new Error("Acesso restrito à direção.");
  return me;
}

async function assertSuperAdminMember(
  supabase: SupabaseClient<Database>,
  userId: string,
) {
  const me = await resolveCurrentMember(supabase, userId);
  if (!me?.is_superadmin) throw new Error("Acesso restrito: apenas Manda-Chuva.");
  return me;
}

async function getMemberTier(id: number): Promise<string | null> {
  const m = await pgOne<{ tier: string | null }>(
    "select tier from members where id = $1",
    [id],
  );
  return m?.tier ?? null;
}

async function getDiscordId(memberId: number): Promise<string | null> {
  const m = await pgOne<{ discord_id: string | null }>(
    "select discord_id from members where id = $1",
    [memberId],
  );
  return m?.discord_id ?? null;
}

// ---------- Rename (display_name + nickname) ----------
export const adminRenameMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.number().int().positive(),
      display_name: z.string().trim().min(1).max(80),
      nickname: z.string().trim().max(80).optional().nullable(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const me = await assertManager(context.supabase, context.userId);
    const before = await pgOne<{ display_name: string | null; nickname: string | null }>(
      "select display_name, nickname from members where id = $1", [data.id],
    );
    await pgQuery(
      "update members set display_name = $2, nickname = $3, updated_at = now() where id = $1",
      [data.id, data.display_name, data.nickname ?? null],
    );
    await logAdminAction(context.supabase, {
      action: "member_renamed",
      actorId: context.userId,
      actorName: me.display_name ?? "Direção",
      targetType: "member",
      targetId: data.id,
      details: `Renomeado de "${before?.display_name ?? ""}" para "${data.display_name}"`,
      afterState: { nickname: data.nickname, previous: before },
    });
    const did = await getDiscordId(data.id);
    if (did)
      await notifyBot({
        action: "rename",
        discord_id: did,
        new_name: data.display_name,
      });
    return { ok: true };
  });

// ---------- Promote / Demote (tier change) ----------
async function syncUserRolesForMember(memberId: number, newTier: string, oldTier: string | null) {
  const profile = await pgOne<{ user_id: string }>(
    `select p.user_id from profiles p join members m on m.discord_id = p.discord_id where m.id = $1`,
    [memberId],
  );
  if (!profile) return;
  const userId = profile.user_id;

  // Add superadmin for manda_chuva
  if (isSuperAdminTier(newTier)) {
    await pgQuery(
      `insert into user_roles (user_id, role) values ($1, 'superadmin') on conflict (user_id, role) do nothing`,
      [userId],
    );
  }
  // Add admin for kingpin/manda_chuva
  if (isAdminTier(newTier)) {
    await pgQuery(
      `insert into user_roles (user_id, role) values ($1, 'admin') on conflict (user_id, role) do nothing`,
      [userId],
    );
  }
  // Remove superadmin if demoted from manda_chuva
  if (isSuperAdminTier(oldTier) && !isSuperAdminTier(newTier)) {
    await pgQuery(`delete from user_roles where user_id = $1 and role = 'superadmin'`, [userId]);
  }
  // Remove admin if demoted from kingpin/manda_chuva to non-admin
  if (isAdminTier(oldTier) && !isAdminTier(newTier)) {
    await pgQuery(`delete from user_roles where user_id = $1 and role = 'admin'`, [userId]);
  }
}

export const adminSetTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.number().int().positive(),
      tier: z.enum(TIERS as [string, ...string[]]),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const targetTier = await getMemberTier(data.id);
    const isPromotingToHighCommand = isAdminTier(data.tier);
    const isDemotingFromHighCommand = targetTier ? isAdminTier(targetTier) : false;

    let me;
    if (isPromotingToHighCommand || isDemotingFromHighCommand) {
      me = await assertSuperAdminMember(context.supabase, context.userId);
    } else {
      me = await assertManager(context.supabase, context.userId);
    }
    const before = await pgOne<{
      tier: string | null;
      discord_id: string | null;
      display_name: string | null;
    }>("select tier, discord_id, display_name from members where id = $1", [data.id]);
    await pgQuery(
      "update members set tier = $2, role = $2, updated_at = now() where id = $1",
      [data.id, data.tier],
    );
    await syncUserRolesForMember(data.id, data.tier, before?.tier ?? null);
    const tierList = getTierOrder();
    const fromIdx = tierList.indexOf(before?.tier ?? "young_blood");
    const toIdx = tierList.indexOf(data.tier);
    const isPromotion = toIdx >= fromIdx;
    await logAdminAction(context.supabase, {
      action: isPromotion ? "member_promoted" : "member_demoted",
      actorId: context.userId,
      actorName: me.display_name ?? "Direção",
      targetType: "member",
      targetId: data.id,
      details: `${before?.display_name ?? "Membro"} ${isPromotion ? "promovido" : "despromovido"} de "${before?.tier ?? "?"}" para "${data.tier}"`,
      afterState: { previous_tier: before?.tier, new_tier: data.tier },
    });
    if (before?.discord_id) {
      await notifyBot({
        action: isPromotion ? "promote" : "demote",
        discord_id: before.discord_id,
        from_tier: before.tier,
        to_tier: data.tier,
      });
    }
    return { ok: true };
  });

// ---------- Kick (soft delete + Discord kick) ----------
export const adminKickMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.number().int().positive(),
      reason: z.string().trim().max(200).optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    const targetTier = await getMemberTier(data.id);
    let me;
    if (targetTier && isAdminTier(targetTier)) {
      me = await assertSuperAdminMember(context.supabase, context.userId);
    } else {
      me = await assertManager(context.supabase, context.userId);
    }
    const target = await pgOne<{ discord_id: string | null; display_name: string | null }>(
      "select discord_id, display_name from members where id = $1", [data.id],
    );
    await pgQuery(
      "update members set deleted_at = now(), updated_at = now() where id = $1",
      [data.id],
    );
    await logAdminAction(context.supabase, {
      action: "member_kicked",
      actorId: context.userId,
      actorName: me.display_name ?? "Direção",
      targetType: "member",
      targetId: data.id,
      details: `${target?.display_name ?? "Membro #" + data.id} kickado${data.reason ? " (" + data.reason + ")" : ""}`,
      afterState: { reason: data.reason },
    });
    if (target?.discord_id)
      await notifyBot({ action: "kick", discord_id: target.discord_id, reason: data.reason });
    return { ok: true };
  });

function toNumber(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "string" ? Number(v) : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// ---------- Stats override (all counters) ----------
export const adminAdjustStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const obj = raw as Record<string, unknown>;
    const parsed = z.object({
      id: z.number().int().positive(),
      kills_delta: z.union([z.number().int(), z.string()]).optional(),
      deaths_delta: z.union([z.number().int(), z.string()]).optional(),
      deliveries_delta: z.union([z.number().int(), z.string()]).optional(),
      sales_delta: z.union([z.number().int(), z.string()]).optional(),
      orders_delta: z.union([z.number().int(), z.string()]).optional(),
      saidas_delta: z.union([z.number().int(), z.string()]).optional(),
      reason: z.string().trim().max(200).optional(),
    }).safeParse(raw);
    if (!parsed.success) throw new Error(parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join("; "));
    return {
      id: parsed.data.id,
      kills_delta: toNumber(parsed.data.kills_delta),
      deaths_delta: toNumber(parsed.data.deaths_delta),
      deliveries_delta: toNumber(parsed.data.deliveries_delta),
      sales_delta: toNumber(parsed.data.sales_delta),
      orders_delta: toNumber(parsed.data.orders_delta),
      saidas_delta: toNumber(parsed.data.saidas_delta),
      reason: parsed.data.reason,
    };
  })
  .handler(async ({ data, context }) => {
    const me = await assertManager(context.supabase, context.userId);
    // Ensure all_time_stats row exists for this member
    await pgQuery(`INSERT INTO all_time_stats (member_id, orders) VALUES ($1, 0) ON CONFLICT (member_id) DO NOTHING`, [data.id]);
    const reason = data.reason || "ajuste manual direção";

    // Kills
    if (data.kills_delta && data.kills_delta !== 0) {
      const n = Math.abs(data.kills_delta);
      if (data.kills_delta > 0) {
        // Batch insert N kill rows in a single query
        await pgQuery(
          `INSERT INTO kill_logs (killer_id, victim_name, spot, notes, created_at, created_by)
           SELECT $1, 'manual', 'ajuste', $2, now(), $3
           FROM generate_series(1, $4)`,
          [data.id, reason, context.userId, n],
        );
      } else {
        await pgQuery(
          "delete from kill_logs where id in (select id from kill_logs where killer_id = $1 order by created_at desc limit $2)",
          [data.id, n],
        );
      }
      // Sync all_time_stats
      await pgQuery(
        `insert into all_time_stats (member_id, kills_total, updated_at)
         values ($1, $2, now())
         on conflict (member_id) do update set kills_total = greatest(0, all_time_stats.kills_total + $2), updated_at = now()`,
        [data.id, data.kills_delta],
      );
    }

    // Deaths
    if (data.deaths_delta && data.deaths_delta !== 0) {
      const n = Math.abs(data.deaths_delta);
      // Best-effort: update all_time_stats deaths directly since we don't track individual death logs
      await pgQuery(
        `insert into all_time_stats (member_id, deaths_total, updated_at)
         values ($1, $2, now())
         on conflict (member_id) do update set deaths_total = greatest(0, all_time_stats.deaths_total + $2), updated_at = now()`,
        [data.id, data.deaths_delta],
      );
    }

    // Deliveries
    if (data.deliveries_delta && data.deliveries_delta !== 0) {
      await pgQuery(
        `insert into all_time_stats (member_id, deliveries, updated_at)
         values ($1, $2, now())
         on conflict (member_id) do update set deliveries = greatest(0, all_time_stats.deliveries + $2), updated_at = now()`,
        [data.id, data.deliveries_delta],
      );
    }

    // Sales
    if (data.sales_delta && data.sales_delta !== 0) {
      await pgQuery(
        `insert into all_time_stats (member_id, sales, updated_at)
         values ($1, $2, now())
         on conflict (member_id) do update set sales = greatest(0, all_time_stats.sales + $2), updated_at = now()`,
        [data.id, data.sales_delta],
      );
    }

    // Orders
    if (data.orders_delta && data.orders_delta !== 0) {
      await pgQuery(
        `insert into all_time_stats (member_id, orders, updated_at)
         values ($1, $2, now())
         on conflict (member_id) do update set orders = greatest(0, all_time_stats.orders + $2), updated_at = now()`,
        [data.id, data.orders_delta],
      );
    }

    // Saídas (operations count)
    if (data.saidas_delta && data.saidas_delta !== 0) {
      await pgQuery(
        `insert into all_time_stats (member_id, saidas_total, updated_at)
         values ($1, $2, now())
         on conflict (member_id) do update set saidas_total = greatest(0, all_time_stats.saidas_total + $2), updated_at = now()`,
        [data.id, data.saidas_delta],
      );
    }

    await logAdminAction(context.supabase, {
      action: "member_stats_adjusted",
      actorId: context.userId,
      actorName: me.display_name ?? "Direção",
      targetType: "member",
      targetId: data.id,
      details: data.reason || "ajuste manual direção",
      afterState: {
        kills_delta: data.kills_delta,
        deaths_delta: data.deaths_delta,
        deliveries_delta: data.deliveries_delta,
        sales_delta: data.sales_delta,
        orders_delta: data.orders_delta,
        saidas_delta: data.saidas_delta,
      },
    });
    return { ok: true };
  });

export const TIER_LIST = TIERS;
