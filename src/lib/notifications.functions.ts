import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";

export type NotificationRow = {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.discord_id) return [];
    return pgQuery<NotificationRow>(
      `select id, type, title, body, link, read, created_at
       from notifications
       where discord_id = $1
       order by created_at desc
       limit 100`,
      [me.discord_id],
    );
  });

export const markNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: number }) => d)
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.discord_id) throw new Error("Sem permissão");
    await pgQuery(
      `update notifications set read = true where id = $1 and discord_id = $2`,
      [data.id, me.discord_id],
    );
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.discord_id) throw new Error("Sem permissão");
    await pgQuery(
      `update notifications set read = true where discord_id = $1 and read = false`,
      [me.discord_id],
    );
    return { ok: true };
  });
