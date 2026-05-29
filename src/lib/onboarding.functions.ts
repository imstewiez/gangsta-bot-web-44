import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { enqueueNotification } from "./notifier.server";
import { resolveCurrentMember } from "./pricing.server";
import { z } from "zod";
import { IdSchema, ReasonSchema, StatusSchema } from "./security";

type TagRequestRow = {
  id: number;
  discord_id: string | null;
  username: string | null;
  full_name: string | null;
  nickname: string | null;
  status: string;
  created_at: string;
  resolved_at: string | null;
  deny_reason: string | null;
};

export const listTagRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string | null }) => ({
    status: StatusSchema.optional().parse(d?.status) ?? "pending",
  }))
  .handler(async ({ data, context }): Promise<TagRequestRow[]> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Acesso restrito à direção.");
    const params: unknown[] = [];
    let where = "";
    if (data.status && data.status !== "all") {
      params.push(data.status);
      where = `where status = $${params.length}`;
    }
    return pgQuery<TagRequestRow>(
      `select id, discord_id, username, full_name, nickname, status,
              created_at, resolved_at, coalesce(deny_reason, denial_reason) as deny_reason
       from tag_requests
       ${where}
       order by created_at desc
       limit 200`,
      params,
    );
  });

export const approveTagRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => ({ id: IdSchema.parse(d.id) }))
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Sem permissão");
    // Atomic tag request approval via stored procedure
    const result = await pgOne<{ sp_approve_tag_request: number }>(
      `SELECT public.sp_approve_tag_request($1, $2) as sp_approve_tag_request`,
      [data.id, `web:${context.userId}`],
    );

    if (!result?.sp_approve_tag_request) throw new Error("Falha ao aprovar tag");

    await enqueueNotification({
      embed: {
        title: "Tag aprovada",
        description: `Pedido #${data.id} aprovado`,
        color: 0x16a34a,
      },
    });
    return { member_id: result.sp_approve_tag_request };
  });

export const denyTagRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number; reason: string }) => {
    return z.object({
      id: IdSchema,
      reason: ReasonSchema,
    }).parse(d);
  })
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Sem permissão");
    const tr = await pgOne<{ discord_id: string | null; status: string }>(
      `select discord_id, status from tag_requests where id = $1`,
      [data.id],
    );
    if (!tr) throw new Error("Pedido não encontrado");
    if (tr.status !== "pending") throw new Error("Pedido já resolvido");
    await pgQuery(
      `update tag_requests
         set status = 'denied', denied_by = $2, deny_reason = $3, denial_reason = $3,
             resolved_at = now(), processed_at = now()
       where id = $1`,
      [data.id, `web:${context.userId}`, data.reason.trim()],
    );
    await enqueueNotification({
      embed: {
        title: "Tag recusada",
        description: tr.discord_id
          ? `<@${tr.discord_id}> · ${data.reason}`
          : data.reason,
        color: 0xb91c1c,
      },
    });
    return { ok: true };
  });
