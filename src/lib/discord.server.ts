// Server-only Discord bot bridge.
// Posts events to the bot webhook (configured via DISCORD_BOT_URL).
// The bot then performs the action in Discord (rename, role change, kick).

import { enqueueNotification } from "./notifier.server";
import { logger } from "./logger.server";

export type DiscordEvent =
  | { action: "rename"; discord_id: string; new_name: string }
  | {
      action: "promote";
      discord_id: string;
      from_tier: string | null;
      to_tier: string;
    }
  | {
      action: "demote";
      discord_id: string;
      from_tier: string | null;
      to_tier: string;
    }
  | { action: "kick"; discord_id: string; reason?: string }
  | {
      action: "prize_defined";
      discord_id: string;
      week_start: string;
      prize_type: string | null;
      prize_description: string | null;
    }
  | {
      action: "prize_delivered";
      discord_id: string;
      week_start: string;
      prize_type: string | null;
      prize_description: string | null;
    };

const RETRY_DELAYS_MS = [1000, 3000, 5000];
const TIMEOUT_MS = 10000;

function isAllowedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    // Allow only HTTPS
    if (u.protocol !== "https:") return false;
    // Optional: restrict to known domains
    // const allowed = ["discord.com", "your-bot-domain.com"];
    // return allowed.some((d) => u.hostname === d || u.hostname.endsWith(`.${d}`));
    return true;
  } catch {
    return false;
  }
}

async function attemptNotify(
  url: string,
  secret: string | undefined,
  body: string,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(secret ? { "x-bot-secret": secret } : {}),
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      logger.error("discord_bot_error", { status: res.status, body: txt });
      return { ok: false, status: res.status, error: `bot_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "timeout" };
    }
    return { ok: false, error: err instanceof Error ? err.message : "network" };
  }
}

export async function notifyBot(
  ev: DiscordEvent,
): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.DISCORD_BOT_URL;
  const secret = process.env.DISCORD_BOT_SECRET;
  if (!url) {
    logger.warn("discord_not_configured", { event: ev.action });
    return { ok: false, error: "bot_not_configured" };
  }

  if (!isAllowedUrl(url)) {
    logger.error("discord_invalid_url", { url });
    return { ok: false, error: "invalid_url" };
  }

  const payload = JSON.stringify({
    ...ev,
    guild_id: process.env.DISCORD_GUILD_ID,
    ts: Date.now(),
  });

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    const result = await attemptNotify(url, secret, payload);
    if (result.ok) return { ok: true };

    // Don't retry on 4xx client errors (they'll fail again)
    if (result.status && result.status >= 400 && result.status < 500) {
      logger.error("discord_client_error", { status: result.status });
      break;
    }

    if (attempt < RETRY_DELAYS_MS.length) {
      logger.warn("discord_retry", { attempt: attempt + 1, error: result.error, delayMs: RETRY_DELAYS_MS[attempt] });
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    } else {
      logger.error("discord_max_retries", { error: result.error });
    }
  }

  // Fallback: enqueue to pending_notifications so the external bot worker can pick it up later
  try {
    await enqueueNotification({
      embed: {
        title: `Discord event failed: ${ev.action}`,
        description: `Event for <@${ev.discord_id}> failed after ${RETRY_DELAYS_MS.length + 1} attempts. Check bot health.`,
        color: 0xef4444,
      },
    });
  } catch {
    // If even the DB enqueue fails, we've done our best
  }

  return { ok: false, error: "max_retries_exceeded" };
}
