import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgOne, pgQuery } from "./pg.server";
import { assertSuperAdmin } from "./admin.functions";
import { logger } from "./logger.server";

export const DEFAULT_HEADER_TICKER_MESSAGES = [
  "Mantém a atividade em dia.",
  "Confirma encomendas, entregas e saídas antes de fechar o turno.",
  "Gestão de materiais é a fonte de verdade.",
  "Respeita a hierarquia e deixa tudo registado.",
];

const CONFIG_KEY = "header_ticker_messages";
const MAX_MESSAGES = 12;
const MAX_MESSAGE_LEN = 160;

const HeaderTickerInput = z.object({
  messages: z.array(z.string().trim().min(1).max(MAX_MESSAGE_LEN)).min(1).max(MAX_MESSAGES),
});

function normalizeMessages(messages: unknown): string[] {
  const parsed = z.array(z.string()).safeParse(messages);
  if (!parsed.success) return DEFAULT_HEADER_TICKER_MESSAGES;

  const cleaned = parsed.data
    .map((message) => message.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, MAX_MESSAGES)
    .map((message) => message.slice(0, MAX_MESSAGE_LEN));

  return cleaned.length ? Array.from(new Set(cleaned)) : DEFAULT_HEADER_TICKER_MESSAGES;
}

async function ensureAppConfigTable() {
  await pgQuery(
    `create table if not exists app_config (
       key text primary key,
       value jsonb not null,
       updated_at timestamptz not null default now(),
       updated_by text null
     )`,
  );
}

export const getHeaderTickerMessages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ messages: string[]; defaults: string[] }> => {
    try {
      await ensureAppConfigTable();
      const row = await pgOne<{ value: string | string[] }>(
        `select value::text as value from app_config where key = $1`,
        [CONFIG_KEY],
      );
      if (!row?.value) return { messages: DEFAULT_HEADER_TICKER_MESSAGES, defaults: DEFAULT_HEADER_TICKER_MESSAGES };
      const raw = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
      return { messages: normalizeMessages(raw), defaults: DEFAULT_HEADER_TICKER_MESSAGES };
    } catch (error) {
      logger.warn("header_ticker_messages_fallback", { error: error instanceof Error ? error.message : String(error) });
      return { messages: DEFAULT_HEADER_TICKER_MESSAGES, defaults: DEFAULT_HEADER_TICKER_MESSAGES };
    }
  });

export const updateHeaderTickerMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => {
    const parsed = HeaderTickerInput.safeParse(raw);
    if (!parsed.success) throw new Error(parsed.error.errors.map((e) => e.message).join("; "));
    return { messages: normalizeMessages(parsed.data.messages) };
  })
  .handler(async ({ data, context }): Promise<{ messages: string[] }> => {
    await assertSuperAdmin(context.userId);
    await ensureAppConfigTable();
    const messages = normalizeMessages(data.messages);
    await pgQuery(
      `insert into app_config (key, value, updated_at, updated_by)
       values ($1, $2::jsonb, now(), $3)
       on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = excluded.updated_by`,
      [CONFIG_KEY, JSON.stringify(messages), context.userId],
    );
    return { messages };
  });
