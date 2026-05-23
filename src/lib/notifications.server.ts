// Server-only helpers for in-app notifications.
// Inserts go into Supabase `notifications` table (created via migration).

import { pgQuery } from "./pg.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type NotifPayload = {
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
};

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

async function insertNotifs(
  entries: { user_id?: string | null; discord_id?: string | null }[],
  n: NotifPayload,
) {
  if (!entries.length) return;
  const rows = entries
    .filter((e) => e.user_id || e.discord_id)
    .map((e) => ({
      user_id: e.user_id ?? null,
      discord_id: e.discord_id ?? null,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      link: n.link ?? null,
    }));
  if (!rows.length) return;
  const { error } = await (supabaseAdmin.from("notifications") as any).insert(rows);
  if (error) console.error("[notifications] insert failed:", error.message);
}

// Notify by Supabase user IDs (already known)
export async function notifyUserIds(
  _supabase: SupabaseClient<Database>,
  userIds: string[],
  n: NotifPayload,
) {
  return insertNotifs(
    userIds.map((uid) => ({ user_id: uid })),
    n,
  );
}

// Notify by discord IDs — resolves to user_ids via profiles; fallback to discord_id
export async function notifyUsers(
  _supabase: SupabaseClient<Database>,
  discordIds: string[],
  n: NotifPayload,
) {
  if (!discordIds.length) return;
  const rows = await pgQuery<{ user_id: string | null; discord_id: string }>(
    `select distinct p.user_id, m.discord_id
     from members m
     left join profiles p on p.discord_id = m.discord_id
     where m.discord_id = any($1::text[])`,
    [discordIds],
  );
  const entries = rows.map((r) => ({
    user_id: r.user_id,
    discord_id: r.discord_id,
  }));
  if (!entries.length) {
    console.warn("[notifications] no members found for discord IDs:", discordIds);
    return;
  }
  return insertNotifs(entries, n);
}

// Notify all managers (patrão di zona, kingpin, manda-chuva, chefia)
export async function notifyManagers(
  supabase: SupabaseClient<Database>,
  n: NotifPayload,
) {
  const managers = await pgQuery<{ discord_id: string }>(
    `select distinct discord_id from members
     where deleted_at is null
       and coalesce(lifecycle_state::text, 'active') in ('active', 'promoted')
       and discord_id is not null
       and (tier in ('patrao_di_zona','kingpin','manda_chuva') or role in ('chefia','manda_chuva','kingpin'))`,
  );
  return notifyUsers(
    supabase,
    managers.map((m) => m.discord_id),
    n,
  );
}
