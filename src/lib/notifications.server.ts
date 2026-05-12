// Server-only helpers for in-app notifications.
// Inserts go into Supabase `notifications` table (created via migration).

import { pgQuery } from "./pg.server";

export type NotifPayload = {
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function insertNotifs(supabase: any, userIds: string[], n: NotifPayload) {
  if (!userIds.length) return;
  const rows = userIds.map((uid) => ({
    user_id: uid,
    type: n.type,
    title: n.title,
    body: n.body ?? null,
    link: n.link ?? null,
  }));
  const { error } = await supabase.from("notifications").insert(rows);
  if (error) console.error("[notifications] insert failed:", error.message);
}

// Notify by Supabase user IDs (already known)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function notifyUserIds(supabase: any, userIds: string[], n: NotifPayload) {
  return insertNotifs(supabase, userIds, n);
}

// Notify by discord IDs — resolves to user_ids via profiles
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function notifyUsers(supabase: any, discordIds: string[], n: NotifPayload) {
  if (!discordIds.length) return;
  const { data } = await supabase
    .from("profiles")
    .select("user_id, discord_id")
    .in("discord_id", discordIds);
  const ids = (data ?? []).map((r: { user_id: string }) => r.user_id);
  return insertNotifs(supabase, ids, n);
}

// Notify all managers (patrão di zona, kingpin, manda-chuva, chefia)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function notifyManagers(supabase: any, n: NotifPayload) {
  const managers = await pgQuery<{ discord_id: string }>(
    `select discord_id from members
     where deleted_at is null
       and discord_id is not null
       and (tier in ('patrao_di_zona','kingpin','manda_chuva') or role in ('chefia','manda_chuva','kingpin'))`
  );
  return notifyUsers(supabase, managers.map((m) => m.discord_id), n);
}
