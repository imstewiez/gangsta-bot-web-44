import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne, withClient } from "./pg.server";
import { enqueueNotification } from "./notifier.server";

export type TagRequestRow = {
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
  .inputValidator((d: { status?: string | null }) => ({ status: d?.status ?? "pending" }))
  .handler(async ({ data }): Promise<TagRequestRow[]> => {
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
      params
    );
  });

export const approveTagRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data, context }) => {
    return withClient(async (c) => {
      await c.query("begin");
      try {
        const r = await c.query(
          `select * from tag_requests where id = $1 for update`,
          [data.id]
        );
        const tr = r.rows[0];
        if (!tr) throw new Error("Pedido não encontrado");
        if (tr.status !== "pending") throw new Error("Pedido já resolvido");

        // Upsert member by discord_id
        const existing = await c.query(
          `select id from members where discord_id = $1 and deleted_at is null`,
          [tr.discord_id]
        );
        let memberId = existing.rows[0]?.id;
        if (!memberId) {
          const ins = await c.query(
            `insert into members (discord_id, username, display_name, full_name, nickname,
                                  role, status, joined_at, lifecycle_state, created_at, updated_at)
             values ($1, $2, $3, $4, $5, 'bairrista', 'active', now(), 'active', now(), now())
             returning id`,
            [tr.discord_id, tr.username, tr.full_name ?? tr.username, tr.full_name, tr.nickname]
          );
          memberId = ins.rows[0].id;
        }

        await c.query(
          `update tag_requests
             set status = 'approved', approved_by = $2, resolved_at = now(), processed_at = now()
           where id = $1`,
          [data.id, `web:${context.userId}`]
        );
        await c.query("commit");
        await enqueueNotification({
          embed: {
            title: "Tag aprovada",
            description: `<@${tr.discord_id}> · ${tr.full_name ?? tr.username ?? ""}`,
            color: 0x16a34a,
          },
        });
        return { member_id: memberId };
      } catch (e) {
        await c.query("rollback");
        throw e;
      }
    });
  });

export const denyTagRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number; reason: string }) => {
    if (!d.reason?.trim()) throw new Error("Razão obrigatória");
    return d;
  })
  .handler(async ({ data, context }) => {
    const tr = await pgOne<{ discord_id: string | null; status: string }>(
      `select discord_id, status from tag_requests where id = $1`,
      [data.id]
    );
    if (!tr) throw new Error("Pedido não encontrado");
    if (tr.status !== "pending") throw new Error("Pedido já resolvido");
    await pgQuery(
      `update tag_requests
         set status = 'denied', denied_by = $2, deny_reason = $3, denial_reason = $3,
             resolved_at = now(), processed_at = now()
       where id = $1`,
      [data.id, `web:${context.userId}`, data.reason.trim()]
    );
    await enqueueNotification({
      embed: {
        title: "Tag recusada",
        description: tr.discord_id ? `<@${tr.discord_id}> · ${data.reason}` : data.reason,
        color: 0xb91c1c,
      },
    });
    return { ok: true };
  });
