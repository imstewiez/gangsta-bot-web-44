// Server-only Discord notifier bridge.
// Inserts a row into pending_notifications which the bot's notifier worker
// reads. If you don't run the worker, these rows accumulate harmlessly.
import { pgQuery } from "./pg.server";

type EmbedField = { name: string; value: string; inline?: boolean };
type EmbedPayload = {
  title?: string;
  description?: string;
  color?: number;
  fields?: EmbedField[];
  footer?: string;
  timestamp?: string;
};

export async function enqueueNotification(opts: {
  channelId?: string | null;
  embed: EmbedPayload;
  priority?: number;
  content?: string | null;
}) {
  try {
    const payload = {
      content: opts.content ?? null,
      embed: {
        ...opts.embed,
        timestamp: opts.embed.timestamp ?? new Date().toISOString(),
        color: opts.embed.color ?? 0xb91c1c,
      },
      source: "web",
    };
    await pgQuery(
      `insert into pending_notifications
         (channel_id, payload, priority, attempts, max_attempts, next_retry_at, created_at)
       values ($1, $2::jsonb, $3, 0, 5, now(), now())`,
      [opts.channelId ?? null, JSON.stringify(payload), opts.priority ?? 5],
    );
  } catch (e) {
    // Don't fail the user-visible action if the queue insert hiccups.
    console.error("[notifier] enqueue failed", e);
  }
}
