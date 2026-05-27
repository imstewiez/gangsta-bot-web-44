// Server-only Discord bot bridge.
// Posts events to the bot webhook (configured via DISCORD_BOT_URL).
// The bot then performs the action in Discord (rename, role change, kick).

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

export async function notifyBot(
  ev: DiscordEvent,
): Promise<{ ok: boolean; error?: string }> {
  const url = process.env.DISCORD_BOT_URL;
  const secret = process.env.DISCORD_BOT_SECRET;
  if (!url) {
    console.warn("[discord] DISCORD_BOT_URL not configured — skipping", ev);
    return { ok: false, error: "bot_not_configured" };
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(secret ? { "x-bot-secret": secret } : {}),
      },
      body: JSON.stringify({
        ...ev,
        guild_id: process.env.DISCORD_GUILD_ID,
        ts: Date.now(),
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[discord] bot returned", res.status, txt);
      return { ok: false, error: `bot_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.warn("[discord] bot webhook timed out — skipping");
      return { ok: false, error: "timeout" };
    }
    console.error("[discord] failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "network" };
  }
}
