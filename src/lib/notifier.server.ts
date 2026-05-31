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
  /**
   * Optional explicit dedupe key. Use for retries/idempotency of the same event.
   * When omitted, no dedupe is applied so legitimate repeated notifications are
   * not collapsed just because they share the same title in the same minute.
   */
  dedupKey?: string | null;
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

    if (opts.dedupKey) {
      await pgQuery(
        `INSERT INTO pending_notifications
           (channel_id, payload, priority, attempts, max_attempts, next_retry_at, created_at, dedup_key)
         SELECT $1, $2::jsonb, $3, 0, 5, now(), now(), $4
         WHERE NOT EXISTS (
           SELECT 1 FROM pending_notifications
           WHERE dedup_key = $4
             AND created_at > now() - interval '10 minutes'
             AND processed_at IS NULL
         )`,
        [opts.channelId ?? null, JSON.stringify(payload), opts.priority ?? 5, opts.dedupKey],
      );
      return;
    }

    await pgQuery(
      `INSERT INTO pending_notifications
         (channel_id, payload, priority, attempts, max_attempts, next_retry_at, created_at, dedup_key)
       VALUES ($1, $2::jsonb, $3, 0, 5, now(), now(), NULL)`,
      [opts.channelId ?? null, JSON.stringify(payload), opts.priority ?? 5],
    );
  } catch (e) {
    // Fail-silently — don't fail the user-visible action if the queue insert hiccups.
    logger.error("enqueue_failed", {
      title: opts.embed.title,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
