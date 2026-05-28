import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne, withClient } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import { enqueueNotification } from "./notifier.server";

export type ParticipantStat = {
  member_id: number;
  member_name: string | null;
  kills: number;
  deaths_count: number;
  role_in_op: string | null;
  net_material_delta: number;
};

export type SaidaRow = {
  id: number;
  tipo: string | null;
  spot: string | null;
  status: string;
  scheduled_at: string | null;
  finalized_at: string | null;
  participant_count: number;
  // stats quando fechada
  enemy_name: string | null;
  enemy_faction: string | null;
  enemy_count: number | null;
  our_kills: number | null;
  deaths: number | null;
  survivors: number | null;
  had_fight: boolean | null;
  was_profitable: boolean | null;
  result_notes: string | null;
  participants_json: ParticipantStat[];
};

// Auto-close any saída older than 12h (opportunistic — runs on every list).
async function autoCloseStaleOperations(): Promise<void> {
  try {
    await pgQuery(
      `update operations
         set status = 'concluida',
             end_time = coalesce(end_time, now()),
             updated_at = now()
       where deleted_at is null
         and status in ('criada','trancagem','em_preparacao','em_curso','em_liquidacao')
         and coalesce(start_time, date::timestamp, created_at) < now() - interval '12 hours'`,
    );
  } catch (err) {
    console.error("[autoCloseStaleOperations] failed:", err);
  }
}

export const listSaidas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<SaidaRow[]> => {
    await autoCloseStaleOperations();
    const rows = await pgQuery<Omit<SaidaRow, 'participants_json'> & { participants_json: string }>(
      `select o.id,
              o.operation_type as tipo,
              o.spot,
              coalesce(o.status, 'criada') as status,
              coalesce(o.start_time,
                       (o.date::timestamp + coalesce(o.scheduled_time, '00:00'::time))) as scheduled_at,
              o.end_time as finalized_at,
              (select count(*)::int from operation_participants op where op.operation_id = o.id) as participant_count,
              o.enemy_name,
              o.enemy_faction,
              o.enemy_count,
              o.our_kills,
              o.deaths,
              o.survivors,
              o.had_fight,
              o.was_profitable,
              o.result_notes,
              coalesce((
                select jsonb_agg(jsonb_build_object(
                  'member_id', p.member_id,
                  'member_name', m.display_name,
                  'kills', coalesce(p.kills, 0),
                  'deaths_count', coalesce(p.deaths_count, 0),
                  'role_in_op', p.role_in_op,
                  'net_material_delta', coalesce(p.net_material_delta, 0)::float
                ) order by coalesce(p.kills,0) desc, m.display_name)
                from operation_participants p
                left join members m on m.id = p.member_id
                where p.operation_id = o.id
              ), '[]'::jsonb)::text as participants_json
       from operations o
       where o.deleted_at is null
       order by coalesce(o.start_time, o.date::timestamp, o.created_at) desc
       limit 100`,
    );
    return rows.map((r) => ({
      ...r,
      participants_json: JSON.parse(r.participants_json) as ParticipantStat[],
    }));
  });

export const addKill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      killer_id: number;
      victim_name: string;
      spot?: string | null;
      notes?: string | null;
    }) => {
      if (!Number.isFinite(d.killer_id)) throw new Error("Killer inválido");
      if (!d.victim_name?.trim()) throw new Error("Vítima obrigatória");
      return d;
    },
  )
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me) throw new Error("Membro não encontrado");
    // Security: only managers can add kills on behalf of others
    if (data.killer_id !== me.id && !me.is_manager) {
      throw new Error("Apenas podes registar kills para ti mesmo.");
    }
    const row = await pgOne<{ id: number }>(
      `insert into kill_logs (killer_id, victim_name, spot, notes, date, created_by, created_at)
       values ($1, $2, $3, $4, current_date, $5, now())
       returning id`,
      [
        data.killer_id,
        data.victim_name.trim(),
        data.spot ?? null,
        data.notes ?? null,
        `web:${context.userId}`,
      ],
    );
    // Keep all_time_stats in sync so profile / member list show the same kills as leaderboard
    await pgQuery(
      `insert into all_time_stats (member_id, kills_total, updated_at)
       values ($1, 1, now())
       on conflict (member_id) do update set kills_total = all_time_stats.kills_total + 1, updated_at = now()`,
      [data.killer_id],
    );
    return { id: row?.id ?? null };
  });

export const createOperation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      operation_type: string;
      spot?: string | null;
      leader_id?: number | null;
      scheduled_at?: string | null;
      notes?: string | null;
    }) => {
      if (!d.operation_type?.trim()) throw new Error("Tipo obrigatório");
      return d;
    },
  )
  .handler(async ({ data, context }) => {
    const sched = data.scheduled_at ? new Date(data.scheduled_at) : null;
    const row = await pgOne<{ id: number }>(
      `insert into operations
         (operation_type, spot, leader_id, status, date, scheduled_time, start_time, notes, created_by, created_at)
       values ($1, $2, $3, 'criada',
         coalesce(($4::timestamptz)::date, current_date),
         ($4::timestamptz)::time,
         $4::timestamptz, $5, $6, now())
       returning id`,
      [
        data.operation_type,
        data.spot ?? null,
        data.leader_id ?? null,
        sched ? sched.toISOString() : null,
        data.notes ?? null,
        `web:${context.userId}`,
      ],
    );
    return { id: row?.id ?? null };
  });

export const createOperationWithParticipants = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      operation_type: string;
      spot?: string | null;
      leader_id?: number | null;
      scheduled_at?: string | null;
      notes?: string | null;
      participants?: number[];
    }) => {
      if (!d.operation_type?.trim()) throw new Error("Tipo obrigatório");
      if (d.participants && d.participants.length > 50) throw new Error("Máximo 50 participantes");
      return d;
    },
  )
  .handler(async ({ data, context }) => {
    const sched = data.scheduled_at ? new Date(data.scheduled_at) : null;
    return withClient(async (c) => {
      const op = await c.query(
        `insert into operations
           (operation_type, spot, leader_id, status, date, scheduled_time, start_time, notes, created_by, created_at)
         values ($1, $2, $3, 'criada',
           coalesce(($4::timestamptz)::date, current_date),
           ($4::timestamptz)::time,
           $4::timestamptz, $5, $6, now())
         returning id`,
        [
          data.operation_type,
          data.spot ?? null,
          data.leader_id ?? null,
          sched ? sched.toISOString() : null,
          data.notes ?? null,
          `web:${context.userId}`,
        ],
      );
      const opId = op.rows[0]?.id;
      if (!opId) throw new Error("Falha ao criar saída");

      // Add participants
      const pids = data.participants ?? [];
      if (pids.length > 0) {
        const values = pids.map((_, i) => `($1, $${i + 2}, 'participante')`).join(",");
        await c.query(
          `insert into operation_participants (operation_id, member_id, role_in_op) values ${values}`,
          [opId, ...pids],
        );
      }

      return { id: opId };
    });
  });

// ---------- Cancel operation ----------
export const cancelOperation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => {
    if (!Number.isFinite(d.id)) throw new Error("id inválido");
    return d;
  })
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    const op = await pgOne<{ id: number; leader_id: number | null; status: string; operation_type: string | null; spot: string | null }>(
      `select id, leader_id, status, operation_type, spot from operations where id = $1 and deleted_at is null`,
      [data.id],
    );
    if (!op) throw new Error("Saída não encontrada");
    if (op.status === "concluida" || op.status === "cancelada") throw new Error("Saída já está fechada");
    const isLeader = op.leader_id === me?.id;
    const isManager = me?.is_manager ?? false;
    if (!isLeader && !isManager) throw new Error("Apenas o líder ou direção pode cancelar.");

    await pgQuery(
      `update operations set status = 'cancelada', end_time = now(), updated_at = now() where id = $1`,
      [data.id],
    );

    // Notify participants
    const participants = await pgQuery<{ member_id: number }>(
      `select member_id from operation_participants where operation_id = $1`,
      [data.id],
    );
    const names = await pgOne<{ display_name: string }>(
      `select display_name from members where id = $1`,
      [me?.id ?? 0],
    );
    for (const p of participants) {
      if (p.member_id === me?.id) continue;
      await enqueueNotification({
        embed: {
          title: "Saída cancelada",
          description: `${names?.display_name ?? "Direção"} cancelou a ${op.operation_type ?? "saída"} · ${op.spot ?? "#" + op.id}`,
          color: 0xef4444,
        },
      });
    }
    return { ok: true };
  });

// ---------- Kick participant ----------
export const kickParticipant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { operation_id: number; member_id: number }) => {
    if (!Number.isFinite(d.operation_id)) throw new Error("operation_id inválido");
    if (!Number.isFinite(d.member_id)) throw new Error("member_id inválido");
    return d;
  })
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    const op = await pgOne<{ id: number; leader_id: number | null; status: string }>(
      `select id, leader_id, status from operations where id = $1 and deleted_at is null`,
      [data.operation_id],
    );
    if (!op) throw new Error("Saída não encontrada");
    if (op.status === "concluida" || op.status === "cancelada") throw new Error("Saída já está fechada");
    const isLeader = op.leader_id === me?.id;
    const isManager = me?.is_manager ?? false;
    if (!isLeader && !isManager) throw new Error("Apenas o líder ou direção pode remover membros.");
    if (data.member_id === me?.id) throw new Error("Não te podes remover a ti mesmo.");

    await pgQuery(
      `delete from operation_participants where operation_id = $1 and member_id = $2`,
      [data.operation_id, data.member_id],
    );
    return { ok: true };
  });

// ---------- Invite members ----------
export const inviteMembers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { operation_id: number; member_ids?: number[]; role?: string }) => {
    if (!Number.isFinite(d.operation_id)) throw new Error("operation_id inválido");
    if (d.member_ids && d.member_ids.length > 50) throw new Error("Máximo 50 membros por convite");
    return d;
  })
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    const op = await pgOne<{ id: number; leader_id: number | null; status: string; operation_type: string | null; spot: string | null }>(
      `select id, leader_id, status, operation_type, spot from operations where id = $1 and deleted_at is null`,
      [data.operation_id],
    );
    if (!op) throw new Error("Saída não encontrada");
    if (op.status === "concluida" || op.status === "cancelada") throw new Error("Saída já está fechada");
    const isLeader = op.leader_id === me?.id;
    const isManager = me?.is_manager ?? false;
    if (!isLeader && !isManager) throw new Error("Apenas o líder ou direção pode convidar.");

    let targetIds: number[] = [];
    if (data.member_ids && data.member_ids.length > 0) {
      targetIds = data.member_ids;
    } else if (data.role) {
      const rows = await pgQuery<{ id: number }>(
        `select id from members where role = $1 and deleted_at is null and lifecycle_state = 'active'`,
        [data.role],
      );
      targetIds = rows.map((r) => r.id);
    }

    if (targetIds.length === 0) throw new Error("Nenhum membro para convidar.");

    // Exclude existing participants
    const existing = await pgQuery<{ member_id: number }>(
      `select member_id from operation_participants where operation_id = $1`,
      [data.operation_id],
    );
    const existingSet = new Set(existing.map((e) => e.member_id));
    const newIds = targetIds.filter((id) => !existingSet.has(id));

    for (const memberId of newIds) {
      await pgQuery(
        `insert into operation_participants (operation_id, member_id, participant_type, role_in_op) values ($1, $2, 'pending', 'membro')`,
        [data.operation_id, memberId],
      );
    }

    // Notify invited members
    for (const memberId of newIds) {
      await enqueueNotification({
        embed: {
          title: "Convite para saída",
          description: `Foste convidado para ${op.operation_type ?? "saída"} · ${op.spot ?? "#" + op.id}`,
          color: 0xa855f7,
        },
      });
    }

    return { invited: newIds.length };
  });

// ---------- Accept / Decline invite ----------
export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { operation_id: number }) => {
    if (!Number.isFinite(d.operation_id)) throw new Error("operation_id inválido");
    return d;
  })
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me) throw new Error("Membro não encontrado");
    await pgQuery(
      `update operation_participants set participant_type = 'caracterizado' where operation_id = $1 and member_id = $2 and participant_type = 'pending'`,
      [data.operation_id, me.id],
    );
    return { ok: true };
  });

export const declineInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { operation_id: number }) => {
    if (!Number.isFinite(d.operation_id)) throw new Error("operation_id inválido");
    return d;
  })
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me) throw new Error("Membro não encontrado");
    await pgQuery(
      `delete from operation_participants where operation_id = $1 and member_id = $2 and participant_type = 'pending'`,
      [data.operation_id, me.id],
    );
    return { ok: true };
  });

// ---------- List roles for invite by tag ----------
export const listRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const rows = await pgQuery<{ role: string; count: number }>(
      `select role, count(*)::int as count from members where deleted_at is null and lifecycle_state = 'active' group by role order by count desc`,
    );
    return rows;
  });

import { assertAdmin } from "./admin.functions";

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number }) => ({
    limit: Math.max(1, Math.min(d?.limit ?? 100, 500)),
  }))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    return pgQuery<{
      id: number;
      action: string;
      entity_type: string | null;
      entity_id: string | null;
      actor_id: string | null;
      actor_name: string | null;
      context: string | null;
      created_at: string;
    }>(
      `select id, action, entity_type, entity_id, actor_id, actor_name, context, created_at
       from audit_logs order by created_at desc limit $1`,
      [data.limit],
    );
  });
