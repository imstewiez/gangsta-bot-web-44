// Server-only Discord API client.
// Used to fetch guild members and resolve roles for automatic member creation.

import { logger } from "./logger.server";

const DISCORD_API = "https://discord.com/api/v10";

function getBotToken(): string | undefined {
  return process.env.DISCORD_BOT_TOKEN;
}

function getGuildId(): string | undefined {
  return process.env.DISCORD_GUILD_ID;
}

export type DiscordGuildMember = {
  user: {
    id: string;
    username: string;
    global_name: string | null;
    bot?: boolean;
  };
  nick: string | null;
  roles: string[];
  joined_at: string;
};

async function discordFetch(path: string, opts?: RequestInit) {
  const token = getBotToken();
  if (!token) {
    throw new Error("DISCORD_BOT_TOKEN não configurado");
  }
  const url = `${DISCORD_API}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      ...(opts?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    logger.error("discord_api_error", { status: res.status, path, body: text });
    throw new Error(`Discord API ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * Fetch all guild members from Discord (handles pagination up to 1000 per request).
 * Returns a map of discord_id -> member.
 */
export async function fetchGuildMembers(): Promise<Map<string, DiscordGuildMember>> {
  const guildId = getGuildId();
  if (!guildId) {
    throw new Error("DISCORD_GUILD_ID não configurado");
  }

  const map = new Map<string, DiscordGuildMember>();
  let after: string | undefined;
  const limit = 1000;

  while (true) {
    const query = new URLSearchParams({ limit: String(limit) });
    if (after) query.set("after", after);

    const batch: DiscordGuildMember[] = await discordFetch(
      `/guilds/${guildId}/members?${query.toString()}`
    );

    if (!Array.isArray(batch) || batch.length === 0) break;

    for (const m of batch) {
      if (!m.user || m.user.bot) continue;
      map.set(m.user.id, m);
    }

    if (batch.length < limit) break;
    after = batch[batch.length - 1].user.id;
  }

  return map;
}

/**
 * Fetch a single guild member by Discord ID.
 */
export async function fetchGuildMember(discordId: string): Promise<DiscordGuildMember | null> {
  const guildId = getGuildId();
  if (!guildId) {
    throw new Error("DISCORD_GUILD_ID não configurado");
  }
  try {
    return await discordFetch(`/guilds/${guildId}/members/${discordId}`);
  } catch (e: any) {
    if (e.message?.includes("404")) return null;
    throw e;
  }
}

// Role configuration — MUST match the Discord bot config
const CHEFIA_TIERS = [
  { key: "manda_chuva", env: "MANDA_CHUVA_ROLE_ID" },
  { key: "kingpin", env: "KINGPIN_ROLE_ID" },
];
const OFICIAL_TIERS = [
  { key: "og", env: "OG_ROLE_ID" },
  { key: "real_gangster", env: "REAL_GANGSTER_ROLE_ID" },
];
const BAIRRISTA_TIERS = [
  { key: "gangster_fodido", env: "GANGSTER_FODIDO_ROLE_ID" },
  { key: "o_gunao", env: "O_GUNAO_ROLE_ID" },
  { key: "young_blood", env: "YOUNG_BLOOD_ROLE_ID" },
];

function getRoleIdFromEnv(envName: string): string | undefined {
  return process.env[envName];
}

function rolesIncludeAny(roleIds: string[], targetIds: (string | undefined)[]): boolean {
  return targetIds.some((id) => id && roleIds.includes(id));
}

function resolveTier(roleIds: string[], tiers: { key: string; env: string }[]): string | null {
  for (const t of tiers) {
    const id = getRoleIdFromEnv(t.env);
    if (id && roleIds.includes(id)) return t.key;
  }
  return null;
}

/**
 * Detect the RP role/tier for a Discord member based on their role IDs.
 * Returns null if the member has no relevant RP roles.
 */
export function detectMemberRole(
  roleIds: string[]
): { role: string; tier: string | null } | null {
  const chefiaIds = [getRoleIdFromEnv("MANDA_CHUVA_ROLE_ID"), getRoleIdFromEnv("KINGPIN_ROLE_ID")].filter(Boolean) as string[];
  const oficialIds = [getRoleIdFromEnv("OG_ROLE_ID"), getRoleIdFromEnv("REAL_GANGSTER_ROLE_ID")].filter(Boolean) as string[];
  const patraoIds = [getRoleIdFromEnv("PATRAO_DI_ZONA_ROLE_ID")].filter(Boolean) as string[];
  const bairristaBaseId = getRoleIdFromEnv("BAIRRISTAS_BASE_ROLE_ID");

  // Chefia
  if (rolesIncludeAny(roleIds, chefiaIds)) {
    return { role: "chefia", tier: resolveTier(roleIds, CHEFIA_TIERS) };
  }

  // Oficial
  if (rolesIncludeAny(roleIds, oficialIds)) {
    return { role: "oficial", tier: resolveTier(roleIds, OFICIAL_TIERS) };
  }

  // Patrão di Zona
  if (rolesIncludeAny(roleIds, patraoIds)) {
    return { role: "patrao_di_zona", tier: "patrao_di_zona" };
  }

  // Bairrista com tier
  const bairristaTier = resolveTier(roleIds, BAIRRISTA_TIERS);
  if (bairristaTier) {
    return { role: "bairrista", tier: bairristaTier };
  }

  // Bairrista sem tier mas com role base
  if (bairristaBaseId && roleIds.includes(bairristaBaseId)) {
    return { role: "bairrista", tier: getRoleIdFromEnv("BAIRRISTA_DEFAULT_TIER") || "young_blood" };
  }

  return null;
}

/**
 * Pick a display name from Discord member data.
 */
export function pickDisplayName(gm: DiscordGuildMember): string {
  const candidates = [gm.nick, gm.user.global_name, gm.user.username];
  for (const c of candidates) {
    if (!c) continue;
    const clean = String(c).replace(/[^\p{L}\p{N}]+/gu, "");
    if (clean.length >= 2) return c;
  }
  return gm.user.username;
}
