import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";

export type PrizeRow = {
  id: number;
  week_start: string;
  week_end: string;
  winner_member_id: number | null;
  winner_name: string | null;
  hybrid_score: number | null;
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
              wp.prize_description, coalesce(wp.prize_status, 'pending') as prize_status,
              wp.defined_by, wp.defined_at, wp.delivered_by, wp.delivered_at, wp.notes
       from weekly_prizes wp
       left join members m on m.id = wp.winner_member_id
       order by wp.week_start desc
       limit 60`
    );
  });

export const setPrize = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number; description?: string | null; status?: string | null; notes?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const isDelivered = data.status === "entregue";
    await pgQuery(
      `update weekly_prizes set
         prize_description = coalesce($2, prize_description),
         prize_status = coalesce($3, prize_status),
         notes = coalesce($4, notes),
         defined_by = coalesce(defined_by, $5),
         defined_at = coalesce(defined_at, now()),
         delivered_by = case when $6 then $5 else delivered_by end,
         delivered_at = case when $6 then now() else delivered_at end,
         updated_at = now()
       where id = $1`,
      [data.id, data.description ?? null, data.status ?? null, data.notes ?? null, `web:${context.userId}`, isDelivered]
    );
    return { ok: true };
  });

export const generatePrizeForCurrentWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Take the most recent week_start in weekly_rankings; pick the top hybrid_score.
    const top = await pgOne<{ member_id: number; week_start: string; week_end: string; score: number | null }>(
      `select wr.member_id, wr.week_start, wr.week_end,
              coalesce(wr.hybrid_score, wr.normalized_score, wr.performance_score)::float as score
       from weekly_rankings wr
       where wr.week_start = (select max(week_start) from weekly_rankings)
       order by score desc nulls last
       limit 1`
    );
    if (!top) throw new Error("Sem ranking para a semana actual");
    const existing = await pgOne<{ id: number }>(
      `select id from weekly_prizes where week_start = $1`,
      [top.week_start]
    );
    if (existing) return { id: existing.id, created: false };
    const row = await pgOne<{ id: number }>(
      `insert into weekly_prizes
         (week_start, week_end, winner_member_id, hybrid_score, prize_status, defined_by, defined_at, created_at, updated_at)
       values ($1, $2, $3, $4, 'por_definir', $5, now(), now(), now())
       returning id`,
      [top.week_start, top.week_end, top.member_id, top.score, `web:${context.userId}`]
    );
    return { id: row?.id, created: true };
  });
