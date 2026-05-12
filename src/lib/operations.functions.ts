import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";

export type SaidaRow = {
  id: number;
  tipo: string | null;
  spot: string | null;
  status: string;
  scheduled_at: string | null;
  finalized_at: string | null;
  participant_count: number;
};

// Auto-close any saída older than 12h (opportunistic — runs on every list).
async function autoCloseStaleOperations(): Promise<void> {
  try {
    await pgQuery(
      `update operations
         set status = 'fechada_auto',
             end_time = coalesce(end_time, now()),
             updated_at = now()
       where deleted_at is null
         and status in ('planeada','em_curso','agendada','iniciada','em_liquidacao')
         and coalesce(start_time, date::timestamp, created_at) < now() - interval '12 hours'`
    );
  } catch (err) {
    console.error("[autoCloseStaleOperations] failed:", err);
  }
}

export const listSaidas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<SaidaRow[]> => {
    await autoCloseStaleOperations();
    return pgQuery<SaidaRow>(
      `select o.id,
              o.operation_type as tipo,
              o.spot,
              coalesce(o.status, 'planeada') as status,
              coalesce(o.start_time,
                       (o.date::timestamp + coalesce(o.scheduled_time, '00:00'::time))) as scheduled_at,
              o.end_time as finalized_at,
              (select count(*)::int from operation_participants op where op.operation_id = o.id) as participant_count
       from operations o
       where o.deleted_at is null
       order by coalesce(o.start_time, o.date::timestamp, o.created_at) desc
       limit 100`
    );
  });

export type KillRow = {
  id: number;
  member_id: number | null;
  member_name: string | null;
  victim: string | null;
  weapon: string | null;
  notes: string | null;
  created_at: string;
};

export const listKills = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<KillRow[]> => {
    return pgQuery<KillRow>(
      `select k.id, k.killer_id as member_id, m.display_name as member_name,
              k.victim_name as victim, k.spot as weapon,
              coalesce(k.notes, k.context) as notes, k.created_at
       from kill_logs k
       left join members m on m.id = k.killer_id
       order by k.created_at desc
       limit 100`
    );
  });

export type RankRow = {
  member_id: number;
  display_name: string | null;
  nick: string | null;
  score: number;
  contribution: number | null;
  performance: number | null;
  reliability: number | null;
};

export const getWeeklyTop = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<RankRow[]> => {
    return pgQuery<RankRow>(
      `select wr.member_id, m.display_name, m.nickname as nick,
              coalesce(wr.hybrid_score, wr.normalized_score, wr.performance_score, 0)::float as score,
              wr.weighted_value::float as contribution,
              wr.performance_score::float as performance,
              wr.return_rate::float as reliability
       from weekly_rankings wr
       join members m on m.id = wr.member_id
       where wr.week_start = (select max(week_start) from weekly_rankings)
       order by score desc nulls last
       limit 50`
    ).catch(() => []);
  });

export const addKill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    killer_id: number;
    victim_name: string;
    spot?: string | null;
    notes?: string | null;
  }) => {
    if (!Number.isFinite(d.killer_id)) throw new Error("Killer inválido");
    if (!d.victim_name?.trim()) throw new Error("Vítima obrigatória");
    return d;
  })
  .handler(async ({ data, context }) => {
    const row = await pgOne<{ id: number }>(
      `insert into kill_logs (killer_id, victim_name, spot, notes, date, created_by, created_at)
       values ($1, $2, $3, $4, current_date, $5, now())
       returning id`,
      [data.killer_id, data.victim_name.trim(), data.spot ?? null, data.notes ?? null, `web:${context.userId}`]
    );
    return { id: row?.id ?? null };
  });

export const createOperation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    operation_type: string;
    spot?: string | null;
    leader_id?: number | null;
    scheduled_at?: string | null;
    notes?: string | null;
  }) => {
    if (!d.operation_type?.trim()) throw new Error("Tipo obrigatório");
    return d;
  })
  .handler(async ({ data, context }) => {
    const sched = data.scheduled_at ? new Date(data.scheduled_at) : null;
    const row = await pgOne<{ id: number }>(
      `insert into operations
         (operation_type, spot, leader_id, status, date, scheduled_time, start_time, notes, created_by, created_at)
       values ($1, $2, $3, 'planeada',
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
      ]
    );
    return { id: row?.id ?? null };
  });
