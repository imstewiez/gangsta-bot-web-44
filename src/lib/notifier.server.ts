// Server-only Discord notifier bridge.
// Inserts a row into pending_notifications which the bot's notifier worker
// reads. If you don't run the worker, these rows accumulate harmlessly.
import { pgQuery } from "./pg.server";
import { logger } from "./logger.server"; 

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

    // Deduplication key based on embed title + current minute
    const dedupKey = `${opts.embed.title ?? ""}_${Math.floor(Date.now() / 60000)}`;

    await pgQuery(
      `INSERT INTO pending_notifications
         (channel_id, payload, priority, attempts, max_attempts, next_retry_at, created_at, dedup_key)
       VALUES ($1, $2::jsonb, $3, 0, 5, now(), now(), $4)
       ON CONFLICT (dedup_key) DO NOTHING`,
      [opts.channelId ?? null, JSON.stringify(payload), opts.priority ?? 5, dedupKey],
    );
  } catch (e) {
    // Fail-silently — don't fail the user-visible action if the queue insert hiccups.
    logger.error("enqueue_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
