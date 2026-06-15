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

type AdminActor = Awaited<ReturnType<typeof resolveCurrentMember>>;

type TargetMember = {
  id: number;
  discord_id: string | null;
  display_name: string | null;
  tier: string | null;
  role: string | null;
};

export type MemberAdminNote = {
  id: number;
  body: string;
  created_at: string;
  created_by_name: string | null;
};

export type MemberDisciplinaryRecord = {
  id: number;
  kind: "aviso" | "punicao";
  title: string | null;
  body: string;
  points: number;
  issued_at: string;
  expires_at: string | null;
  resolved_at: string | null;
  created_by_name: string | null;
};

export type MemberAbsenceRecord = {
  id: string;
  starts_at: string;
  ends_at: string | null;
  reason: string | null;
  ended_at: string | null;
  created_by_name: string | null;
};

export type MemberAdminRecords = {
  notes: MemberAdminNote[];
  disciplinary: MemberDisciplinaryRecord[];
  active_absence: MemberAbsenceRecord | null;
  absences: MemberAbsenceRecord[];
};

const TIER_RANK: Record<string, number> = {
  young_blood: 1,
  o_gunao: 2,
  gangster_fodido: 3,
  patrao_di_zona: 4,
  real_gangster: 5,
  og: 6,
  kingpin: 7,
  manda_chuva: 8,
};

function tierRank(tier: string | null | undefined): number {
  return TIER_RANK[String(tier ?? "").trim().toLowerCase()] ?? 0;
}

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

async function getTargetMember(id: number): Promise<TargetMember | null> {
  return pgOne<TargetMember>(
    `select id, discord_id, display_name, tier, role
       from members
      where id = $1
        and deleted_at is null
      limit 1`,
    [id],
  );
}

function assertCanManageTarget(me: NonNullable<AdminActor>, target: TargetMember, action = "alterar este membro") {
  if (me.is_superadmin) return;
  if (me.id === target.id) throw new Error("Não podes alterar a tua própria conta por aqui.");
  if (tierRank(me.tier) <= tierRank(target.tier)) {
    throw new Error(`Não podes ${action} do mesmo cargo ou superior ao teu.`);
  }
}

function assertCanSetTier(me: NonNullable<AdminActor>, target: TargetMember, newTier: string) {
  assertCanManageTarget(me, target, "alterar alguém");
  if (me.is_superadmin) return;
  if (tierRank(me.tier) <= tierRank(newTier)) {
    throw new Error("Não podes promover/despromover alguém para o teu cargo ou superior.");
  }
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
    const before = await getTargetMember(data.id);
    if (!before) throw new Error("Membro não encontrado ou já inativo.");
    assertCanManageTarget(me, before, "renomear alguém");

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
      details: `Renomeado de "${before.display_name ?? ""}" para "${data.display_name}"`,
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

  if (isSuperAdminTier(newTier)) {
    await pgQuery(
      `insert into user_roles (user_id, role) values ($1, 'superadmin') on conflict (user_id, role) do nothing`,
      [userId],
    );
  }
  if (isAdminTier(newTier)) {
    await pgQuery(
      `insert into user_roles (user_id, role) values ($1, 'admin') on conflict (user_id, role) do nothing`,
      [userId],
    );
  }
  if (isSuperAdminTier(oldTier) && !isSuperAdminTier(newTier)) {
    await pgQuery(`delete from user_roles where user_id = $1 and role = 'superadmin'`, [userId]);
  }
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
    const before = await getTargetMember(data.id);
    if (!before) throw new Error("Membro não encontrado ou já inativo.");

    const isPromotingToHighCommand = isAdminTier(data.tier);
    const isDemotingFromHighCommand = before.tier ? isAdminTier(before.tier) : false;
    const me = isPromotingToHighCommand || isDemotingFromHighCommand
      ? await assertSuperAdminMember(context.supabase, context.userId)
      : await assertManager(context.supabase, context.userId);
    assertCanSetTier(me, before, data.tier);

    await pgQuery(
      "update members set tier = $2, role = $2, status = 'ativo', lifecycle_state = 'active', deleted_at = null, updated_at = now() where id = $1",
      [data.id, data.tier],
    );
    await syncUserRolesForMember(data.id, data.tier, before.tier ?? null);
    const tierList = getTierOrder();
    const fromIdx = tierList.indexOf(before.tier ?? "young_blood");
    const toIdx = tierList.indexOf(data.tier);
    const isPromotion = toIdx >= fromIdx;
    await logAdminAction(context.supabase, {
      action: isPromotion ? "member_promoted" : "member_demoted",
      actorId: context.userId,
      actorName: me.display_name ?? "Direção",
      targetType: "member",
      targetId: data.id,
      details: `${before.display_name ?? "Membro"} ${isPromotion ? "promovido" : "despromovido"} de "${before.tier ?? "?"}" para "${data.tier}"`,
      afterState: { previous_tier: before.tier, new_tier: data.tier },
    });
    if (before.discord_id) {
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
    const me = await assertManager(context.supabase, context.userId);
    const target = await getTargetMember(data.id);
    if (!target) throw new Error("Membro não encontrado ou já inativo.");
    assertCanManageTarget(me, target, "expulsar alguém");

    const reason = data.reason || "Expulso pela chefia";
    await pgQuery(
      `update members set
         role = 'inativo',
         status = 'inativo',
         lifecycle_state = 'removed',
         lifecycle_changed_at = now(),
         lifecycle_changed_by = $2,
         lifecycle_notes = $3,
         deleted_at = now(),
         updated_at = now()
       where id = $1`,
      [data.id, context.userId, reason],
    );
    await logAdminAction(context.supabase, {
      action: "member_kicked",
      actorId: context.userId,
      actorName: me.display_name ?? "Direção",
      targetType: "member",
      targetId: data.id,
      details: `${target.display_name ?? "Membro #" + data.id} kickado${reason ? " (" + reason + ")" : ""}`,
      afterState: { reason, previous_tier: target.tier, previous_role: target.role },
    });
    if (target.discord_id)
      await notifyBot({ action: "kick", discord_id: target.discord_id, reason });
    return { ok: true };
  });

function toNumber(v: unknown): number | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const n = typeof v === "string" ? Number(v) : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function isoOrNull(value: unknown): string | null {
  if (value == null || value === "") return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new Error("Data invalida");
  return date.toISOString();
}

async function assertCanUseMemberAdminRecords(
  supabase: SupabaseClient<Database>,
  userId: string,
  memberId: number,
  action: string,
) {
  const me = await assertManager(supabase, userId);
  const target = await getTargetMember(memberId);
  if (!target) throw new Error("Membro nao encontrado ou ja inativo.");
  assertCanManageTarget(me, target, action);
  return { me, target };
}

// ---------- Stats override (all counters) ----------
export const adminAdjustStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
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
    const target = await getTargetMember(data.id);
    if (!target) throw new Error("Membro não encontrado ou já inativo.");
    assertCanManageTarget(me, target, "ajustar estatísticas de alguém");

    await pgQuery(`INSERT INTO all_time_stats (member_id, orders) VALUES ($1, 0) ON CONFLICT (member_id) DO NOTHING`, [data.id]);
    const reason = data.reason || "ajuste manual direção";

    if (data.kills_delta && data.kills_delta !== 0) {
      const n = Math.abs(data.kills_delta);
      if (data.kills_delta > 0) {
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
      await pgQuery(
        `insert into all_time_stats (member_id, kills_total, updated_at)
         values ($1, $2, now())
         on conflict (member_id) do update set kills_total = greatest(0, all_time_stats.kills_total + $2), updated_at = now()`,
        [data.id, data.kills_delta],
      );
    }

    if (data.deaths_delta && data.deaths_delta !== 0) {
      await pgQuery(
        `insert into all_time_stats (member_id, deaths_total, updated_at)
         values ($1, $2, now())
         on conflict (member_id) do update set deaths_total = greatest(0, all_time_stats.deaths_total + $2), updated_at = now()`,
        [data.id, data.deaths_delta],
      );
    }

    if (data.deliveries_delta && data.deliveries_delta !== 0) {
      await pgQuery(
        `insert into all_time_stats (member_id, deliveries, updated_at)
         values ($1, $2, now())
         on conflict (member_id) do update set deliveries = greatest(0, all_time_stats.deliveries + $2), updated_at = now()`,
        [data.id, data.deliveries_delta],
      );
    }

    if (data.sales_delta && data.sales_delta !== 0) {
      await pgQuery(
        `insert into all_time_stats (member_id, sales, updated_at)
         values ($1, $2, now())
         on conflict (member_id) do update set sales = greatest(0, all_time_stats.sales + $2), updated_at = now()`,
        [data.id, data.sales_delta],
      );
    }

    if (data.orders_delta && data.orders_delta !== 0) {
      await pgQuery(
        `insert into all_time_stats (member_id, orders, updated_at)
         values ($1, $2, now())
         on conflict (member_id) do update set orders = greatest(0, all_time_stats.orders + $2), updated_at = now()`,
        [data.id, data.orders_delta],
      );
    }

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
      details: reason,
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

export const listMemberAdminRecords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { member_id: number }) => ({ member_id: z.number().int().positive().parse(d.member_id) }))
  .handler(async ({ data, context }): Promise<MemberAdminRecords> => {
    await assertCanUseMemberAdminRecords(context.supabase, context.userId, data.member_id, "ver dados internos de alguem");

    const [notes, disciplinary, absences] = await Promise.all([
      pgQuery<MemberAdminNote>(
        `select n.id, n.body, n.created_at,
                coalesce(actor.display_name, actor.nickname) as created_by_name
           from member_notes n
           left join members actor on actor.id = n.created_by_member_id
          where n.member_id = $1
            and n.deleted_at is null
          order by n.created_at desc
          limit 100`,
        [data.member_id],
      ),
      pgQuery<MemberDisciplinaryRecord>(
        `select d.id, d.kind, d.title, d.body, d.points,
                d.issued_at, d.expires_at, d.resolved_at,
                coalesce(actor.display_name, actor.nickname) as created_by_name
           from member_disciplinary_records d
           left join members actor on actor.id = d.created_by_member_id
          where d.member_id = $1
            and d.deleted_at is null
          order by d.issued_at desc, d.created_at desc
          limit 100`,
        [data.member_id],
      ),
      pgQuery<MemberAbsenceRecord>(
        `select a.id::text as id, a.starts_at, a.ends_at, a.reason, a.ended_at,
                coalesce(actor.display_name, actor.nickname) as created_by_name
           from member_absences a
           left join members actor on actor.id = a.created_by_member_id
          where a.member_id = $1
          order by a.starts_at desc
          limit 50`,
        [data.member_id],
      ),
    ]);

    return {
      notes,
      disciplinary,
      active_absence: absences.find((absence) => absence.ended_at == null) ?? null,
      absences,
    };
  });

export const adminAddMemberNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({
    member_id: z.number().int().positive(),
    body: z.string().trim().min(1).max(2000),
  }).parse(raw))
  .handler(async ({ data, context }) => {
    const { me, target } = await assertCanUseMemberAdminRecords(context.supabase, context.userId, data.member_id, "adicionar notas a alguem");
    const row = await pgOne<{ id: number }>(
      `insert into member_notes (member_id, body, created_by_user_id, created_by_member_id)
       values ($1, $2, $3, $4)
       returning id`,
      [data.member_id, data.body, context.userId, me.id],
    );
    await logAdminAction(context.supabase, {
      action: "member_note_added",
      actorId: context.userId,
      actorName: me.display_name ?? "Direcao",
      targetType: "member",
      targetId: data.member_id,
      details: `Nota adicionada a ${target.display_name ?? "membro #" + data.member_id}`,
      afterState: { note_id: row?.id },
    });
    return { id: row?.id ?? null };
  });

export const adminDeleteMemberNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.number().int().positive() }).parse(raw))
  .handler(async ({ data, context }) => {
    const note = await pgOne<{ member_id: number }>(
      `select member_id from member_notes where id = $1 and deleted_at is null`,
      [data.id],
    );
    if (!note) throw new Error("Nota nao encontrada.");
    const { me } = await assertCanUseMemberAdminRecords(context.supabase, context.userId, note.member_id, "remover notas de alguem");
    await pgQuery(`update member_notes set deleted_at = now(), deleted_by_user_id = $2 where id = $1`, [data.id, context.userId]);
    await logAdminAction(context.supabase, {
      action: "member_note_removed",
      actorId: context.userId,
      actorName: me.display_name ?? "Direcao",
      targetType: "member",
      targetId: note.member_id,
      details: "Nota removida",
      afterState: { note_id: data.id },
    });
    return { ok: true };
  });

export const adminAddDisciplinaryRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({
    member_id: z.number().int().positive(),
    kind: z.enum(["aviso", "punicao"]),
    title: z.string().trim().max(120).optional().nullable(),
    body: z.string().trim().min(1).max(2000),
    points: z.union([z.number().int(), z.string()]).optional().nullable(),
    expires_at: z.string().optional().nullable(),
  }).parse(raw))
  .handler(async ({ data, context }) => {
    const { me, target } = await assertCanUseMemberAdminRecords(context.supabase, context.userId, data.member_id, "adicionar avisos/punicoes a alguem");
    const points = toNumber(data.points) ?? 0;
    const row = await pgOne<{ id: number }>(
      `insert into member_disciplinary_records
         (member_id, kind, title, body, points, expires_at, created_by_user_id, created_by_member_id)
       values ($1, $2, $3, $4, $5, $6::timestamptz, $7, $8)
       returning id`,
      [data.member_id, data.kind, data.title || null, data.body, Math.round(points), isoOrNull(data.expires_at), context.userId, me.id],
    );
    await logAdminAction(context.supabase, {
      action: data.kind === "aviso" ? "member_warning_added" : "member_punishment_added",
      actorId: context.userId,
      actorName: me.display_name ?? "Direcao",
      targetType: "member",
      targetId: data.member_id,
      details: `${data.kind === "aviso" ? "Aviso" : "Punicao"} adicionada a ${target.display_name ?? "membro #" + data.member_id}`,
      afterState: { record_id: row?.id, points },
    });
    return { id: row?.id ?? null };
  });

export const adminDeleteDisciplinaryRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.number().int().positive() }).parse(raw))
  .handler(async ({ data, context }) => {
    const record = await pgOne<{ member_id: number; kind: string }>(
      `select member_id, kind from member_disciplinary_records where id = $1 and deleted_at is null`,
      [data.id],
    );
    if (!record) throw new Error("Registo nao encontrado.");
    const { me } = await assertCanUseMemberAdminRecords(context.supabase, context.userId, record.member_id, "remover avisos/punicoes de alguem");
    await pgQuery(`update member_disciplinary_records set deleted_at = now(), deleted_by_user_id = $2 where id = $1`, [data.id, context.userId]);
    await logAdminAction(context.supabase, {
      action: record.kind === "aviso" ? "member_warning_removed" : "member_punishment_removed",
      actorId: context.userId,
      actorName: me.display_name ?? "Direcao",
      targetType: "member",
      targetId: record.member_id,
      details: `${record.kind === "aviso" ? "Aviso" : "Punicao"} removida`,
      afterState: { record_id: data.id },
    });
    return { ok: true };
  });

export const adminSetMemberAbsence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({
    member_id: z.number().int().positive(),
    reason: z.string().trim().max(500).optional().nullable(),
    ends_at: z.string().optional().nullable(),
  }).parse(raw))
  .handler(async ({ data, context }) => {
    const { me, target } = await assertCanUseMemberAdminRecords(context.supabase, context.userId, data.member_id, "marcar ausencia de alguem");
    const endsAt = isoOrNull(data.ends_at);
    await pgQuery(
      `update member_absences
          set ended_at = coalesce(ended_at, now()),
              ended_by_user_id = $2,
              updated_at = now()
        where member_id = $1
          and ended_at is null`,
      [data.member_id, context.userId],
    );
    const row = await pgOne<{ id: string }>(
      `insert into member_absences
         (member_id, starts_at, ends_at, reason, created_by_user_id, created_by_member_id)
       values ($1, now(), $2::timestamptz, $3, $4, $5)
       returning id::text as id`,
      [data.member_id, endsAt, data.reason || null, context.userId, me.id],
    );
    await pgQuery(
      `update members
          set status = 'ausente',
              lifecycle_state = 'absent',
              lifecycle_changed_at = now(),
              lifecycle_changed_by = $2,
              lifecycle_notes = $3,
              updated_at = now()
        where id = $1`,
      [data.member_id, `web:${context.userId}`, data.reason || "Ausencia marcada pela direcao"],
    );
    await logAdminAction(context.supabase, {
      action: "member_absence_started",
      actorId: context.userId,
      actorName: me.display_name ?? "Direcao",
      targetType: "member",
      targetId: data.member_id,
      details: `${target.display_name ?? "Membro"} marcado como ausente${endsAt ? ` ate ${endsAt}` : ""}`,
      afterState: { absence_id: row?.id, ends_at: endsAt, reason: data.reason || null },
    });
    return { id: row?.id ?? null };
  });

export const adminEndMemberAbsence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ member_id: z.number().int().positive() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { me, target } = await assertCanUseMemberAdminRecords(context.supabase, context.userId, data.member_id, "terminar ausencia de alguem");
    await pgQuery(
      `update member_absences
          set ended_at = coalesce(ended_at, now()),
              ended_by_user_id = $2,
              updated_at = now()
        where member_id = $1
          and ended_at is null`,
      [data.member_id, context.userId],
    );
    await pgQuery(
      `update members
          set status = 'ativo',
              lifecycle_state = 'active',
              lifecycle_changed_at = now(),
              lifecycle_changed_by = $2,
              lifecycle_notes = 'Ausencia terminada pela direcao',
              updated_at = now()
        where id = $1`,
      [data.member_id, `web:${context.userId}`],
    );
    await logAdminAction(context.supabase, {
      action: "member_absence_ended",
      actorId: context.userId,
      actorName: me.display_name ?? "Direcao",
      targetType: "member",
      targetId: data.member_id,
      details: `${target.display_name ?? "Membro"} voltou a ativo`,
    });
    return { ok: true };
  });

export const TIER_LIST = TIERS;
