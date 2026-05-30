import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import { notifyBot } from "./discord.server";
import { logAdminAction } from "./logging.functions";

type PrizeRow = {
  id: number;
  week_start: string;
  week_end: string;
  winner_member_id: number | null;
  winner_name: string | null;
  hybrid_score: number | null;
  prize_type: string | null;
  prize_description: string | null;
  prize_status: string;
  defined_by: string | null;
  defined_at: string | null;
  delivered_by: string | null;
  delivered_at: string | null;
  notes: string | null;
};

export const listPrizes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<PrizeRow[]> => {
    return pgQuery<PrizeRow>(
      `select wp.id, wp.week_start, wp.week_end, wp.winner_member_id,
              m.display_name as winner_name,
              wp.hybrid_score::float as hybrid_score,
              wp.prize_type, wp.prize_description,
              coalesce(wp.prize_status, 'por_definir') as prize_status,
              wp.defined_by, wp.defined_at, wp.delivered_by, wp.delivered_at, wp.notes
       from weekly_prizes wp
       left join members m on m.id = wp.winner_member_id
       order by wp.week_start desc
       limit 60`,
    );
  });

const PRIZE_TYPES = ["Casa", "Arma", "Carro", "Dinheiro", "Outro"] as const;
export type PrizeType = (typeof PRIZE_TYPES)[number];

export const setPrize = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id: number;
      prize_type?: string | null;
      description?: string | null;
      status?: string | null;
      notes?: string | null;
    }) => {
      const id = Number(d?.id);
      if (!Number.isFinite(id) || id <= 0) throw new Error("ID inválido");
      if (d.prize_type != null && d.prize_type.length > 50) throw new Error("Tipo de prémio demasiado longo");
      if (d.description != null && d.description.length > 500) throw new Error("Descrição demasiado longa");
      if (d.status != null && d.status.length > 50) throw new Error("Status demasiado longo");
      if (d.notes != null && d.notes.length > 1000) throw new Error("Notas demasiado longas");
      return { id, prize_type: d.prize_type ?? null, description: d.description ?? null, status: d.status ?? null, notes: d.notes ?? null };
    },
  )
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Sem permissão");
    const isDelivered = data.status === "entregue";

    // Fetch winner info before updating
    const prizeRow = await pgOne<{
      week_start: string;
      winner_member_id: number | null;
    }>(
      `select week_start, winner_member_id from weekly_prizes where id = $1`,
      [data.id],
    );

    await pgQuery(
      `update weekly_prizes set
         prize_type = coalesce($2, prize_type),
         prize_description = coalesce($3, prize_description),
         prize_status = coalesce($4, prize_status),
         notes = coalesce($5, notes),
         defined_by = coalesce(defined_by, $6),
         defined_at = coalesce(defined_at, now()),
         delivered_by = case when $7 then $6 else delivered_by end,
         delivered_at = case when $7 then now() else delivered_at end,
         updated_at = now()
       where id = $1`,
      [
        data.id,
        data.prize_type ?? null,
        data.description ?? null,
        data.status ?? null,
        data.notes ?? null,
        `web:${context.userId}`,
        isDelivered,
      ],
    );

    // Notify bot to DM winner
    if (prizeRow?.winner_member_id) {
      const memberRow = await pgOne<{ discord_id: string | null }>(
        `select discord_id from members where id = $1 and deleted_at is null`,
        [prizeRow.winner_member_id],
      );
      if (memberRow?.discord_id) {
        const action = isDelivered ? "prize_delivered" : "prize_defined";
        await notifyBot({
          action,
          discord_id: memberRow.discord_id,
          week_start: prizeRow.week_start,
          prize_type: data.prize_type ?? null,
          prize_description: data.description ?? null,
        }).catch(() => {});
      }
    }

    await logAdminAction(context.supabase, {
      action: isDelivered ? "prize_delivered" : "prize_set",
      actorId: context.userId,
      actorName: me.display_name ?? "Direção",
      targetType: "prize",
      targetId: data.id,
      details: isDelivered
        ? `Prémio #${data.id} marcado como entregue`
        : `Prémio #${data.id} definido: ${data.prize_type ?? "?"}`,
      afterState: { prize_type: data.prize_type, status: data.status },
    });
    return { ok: true };
  });

export const generatePrizeForCurrentWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Sem permissão");
    // Take the most recent week_start in weekly_rankings; pick the top hybrid_score.
    const top = await pgOne<{
      member_id: number;
      week_start: string;
      week_end: string;
      score: number | null;
    }>(
      `select wr.member_id, wr.week_start, wr.week_end,
              coalesce(wr.hybrid_score, wr.normalized_score, wr.performance_score)::float as score
       from weekly_rankings wr
       where wr.week_start = (select max(week_start) from weekly_rankings)
       order by score desc nulls last
       limit 1`,
    );
    if (!top) throw new Error("Sem ranking para a semana actual");
    const existing = await pgOne<{ id: number }>(
      `select id from weekly_prizes where week_start = $1`,
      [top.week_start],
    );
    if (existing) return { id: existing.id, created: false };
    const row = await pgOne<{ id: number }>(
      `insert into weekly_prizes
         (week_start, week_end, winner_member_id, hybrid_score, prize_status, defined_by, defined_at, created_at, updated_at)
       values ($1, $2, $3, $4, 'por_definir', $5, now(), now(), now())
       returning id`,
      [
        top.week_start,
        top.week_end,
        top.member_id,
        top.score,
        `web:${context.userId}`,
      ],
    );
    await logAdminAction(context.supabase, {
      action: "prize_set",
      actorId: context.userId,
      actorName: me.display_name ?? "Direção",
      targetType: "prize",
      targetId: row?.id ?? 0,
      details: `Prémio gerado para semana ${top.week_start} (vencedor: ${top.member_id})`,
    });
    return { id: row?.id, created: true };
  });
