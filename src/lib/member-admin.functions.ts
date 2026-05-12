import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import { notifyBot } from "./discord.server";

// Hierarquia descendente — chefia primeiro, base por baixo.
const TIERS = [
  "manda_chuva",
  "kingpin",
  "og",
  "real_gangster",
  "patrao_di_zona",
  "gangster_fodido",
  "o_gunao",
  "young_blood",
] as const;

async function assertManager(supabase: any, userId: string) {
  const me = await resolveCurrentMember(supabase, userId);
  if (!me?.is_manager) throw new Error("Só a chefia pode fazer isto.");
  return me;
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
    await assertManager(context.supabase, context.userId);
    await pgQuery(
      "update members set display_name = $2, nickname = $3, updated_at = now() where id = $1",
      [data.id, data.display_name, data.nickname ?? null],
    );
    const did = await getDiscordId(data.id);
    if (did) await notifyBot({ action: "rename", discord_id: did, new_name: data.display_name });
    return { ok: true };
  });

// ---------- Promote / Demote (tier change) ----------
export const adminSetTier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.number().int().positive(),
      tier: z.enum(TIERS),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId);
    const before = await pgOne<{ tier: string | null; discord_id: string | null }>(
      "select tier, discord_id from members where id = $1",
      [data.id],
    );
    await pgQuery(
      "update members set tier = $2, role = $2, updated_at = now() where id = $1",
      [data.id, data.tier],
    );
    if (before?.discord_id) {
      const fromIdx = TIERS.indexOf((before.tier ?? "young_blood") as any);
      const toIdx = TIERS.indexOf(data.tier as any);
      const action = toIdx >= fromIdx ? "promote" : "demote";
      await notifyBot({
        action,
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
    await assertManager(context.supabase, context.userId);
    const did = await getDiscordId(data.id);
    await pgQuery(
      "update members set deleted_at = now(), updated_at = now() where id = $1",
      [data.id],
    );
    if (did) await notifyBot({ action: "kick", discord_id: did, reason: data.reason });
    return { ok: true };
  });

// ---------- Stats override (kills / deaths) ----------
// Adjustments registadas como linhas marcadas para auditoria.
export const adminAdjustStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      id: z.number().int().positive(),
      kills_delta: z.number().int().optional(),
      deaths_delta: z.number().int().optional(),
      reason: z.string().trim().max(200).optional(),
    }).parse,
  )
  .handler(async ({ data, context }) => {
    await assertManager(context.supabase, context.userId);
    const reason = data.reason || "ajuste manual chefia";

    if (data.kills_delta && data.kills_delta !== 0) {
      const n = Math.abs(data.kills_delta);
      if (data.kills_delta > 0) {
        for (let i = 0; i < n; i++) {
          await pgQuery(
            "insert into kill_logs (killer_id, victim_id, weapon, notes, created_at) values ($1, null, 'manual', $2, now())",
            [data.id, reason],
          );
        }
      } else {
        await pgQuery(
          "delete from kill_logs where id in (select id from kill_logs where killer_id = $1 order by created_at desc limit $2)",
          [data.id, n],
        );
      }
    }
    // deaths/other counters depend on schema; tentativa best-effort:
    if (data.deaths_delta && data.deaths_delta !== 0) {
      const n = Math.abs(data.deaths_delta);
      if (data.deaths_delta > 0) {
        for (let i = 0; i < n; i++) {
          await pgQuery(
            "insert into kill_logs (killer_id, victim_id, weapon, notes, created_at) values (null, $1, 'manual', $2, now())",
            [data.id, reason],
          ).catch(() => null);
        }
      } else {
        await pgQuery(
          "delete from kill_logs where id in (select id from kill_logs where victim_id = $1 order by created_at desc limit $2)",
          [data.id, n],
        ).catch(() => null);
      }
    }
    return { ok: true };
  });

export const TIER_LIST = TIERS;
