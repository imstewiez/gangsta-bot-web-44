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
  | { action: "kick"; discord_id: string; reason?: string };

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
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[discord] bot returned", res.status, txt);
      return { ok: false, error: `bot_${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    console.error("[discord] failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "network" };
  }
}
