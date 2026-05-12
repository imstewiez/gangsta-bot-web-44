import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------- AUTO-CLOSE saídas after 12h ----------
// Run opportunistically before listing operations / availability.
async function autoCloseStaleOperations(): Promise<void> {
  try {
    await pgQuery(
      `update operations
         set status = 'fechada_auto',
             end_time = coalesce(end_time, now()),
             updated_at = now()
       where deleted_at is null
         and status in ('planeada','em_curso','agendada','iniciada','em_liquidacao')
         and coalesce(start_time, date::timestamp, created_at) < now() - interval '12 hours'`,
    );
  } catch (err) {
    console.error("[autoCloseStaleOperations] failed:", err);
  }
}

export const listAvailability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return pgQuery<{
      id: number;
      session_date: string;
      status: string;
      header_text: string | null;
      created_at: string;
      vote_count: number;
    }>(
      `select s.id, s.session_date, coalesce(s.status,'open') as status,
              s.header_text, s.created_at,
              (select count(*)::int from availability_votes v where v.session_id = s.id) as vote_count
       from availability_sessions s
       where s.deleted_at is null
       order by s.session_date desc, s.created_at desc
       limit 60`,
    );
  });

export const getAvailabilityVotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { session_id: number }) => d)
  .handler(async ({ data }) => {
    const [slots, votes] = await Promise.all([
      pgQuery<{ id: number; slot_label: string; position: number }>(
        `select id, slot_label, position from availability_slots where session_id = $1 order by position`,
        [data.session_id],
      ),
      pgQuery<{ slot_id: number; vote_state: string; discord_user_id: string }>(
        `select slot_id, vote_state, discord_user_id from availability_votes where session_id = $1`,
        [data.session_id],
      ),
    ]);
    return { slots, votes };
  });

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  if (!(data ?? []).some((r) => r.role === "admin")) {
    throw new Error("Forbidden: admin only");
  }
}

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
