// Server-only PostgreSQL client using Supabase RPC (Edge-compatible).
// Uses Supabase REST API instead of TCP sockets — works reliably on Cloudflare Workers.
// NEVER import this file from client code.
import { createClient } from "@supabase/supabase-js";
import { escapeSqlParam } from "./security";

let supabaseInstance: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabaseInstance) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY must be set");
    }
    supabaseInstance = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseInstance;
}

/**
 * Execute a SQL query via Supabase RPC (exec_sql).
 * Parameters are safely escaped before interpolation.
 * NEVER concatenate user input directly into the query text.
 */
export async function pgQuery<T = any>(
  text: string,
  params: ReadonlyArray<unknown> = [],
): Promise<T[]> {
  try {
    let query = text;
    // Replace placeholders from highest index to lowest to avoid $10 becoming $1
    // Use split/join instead of replace() to avoid $& / $$ interpretation in replacement strings
    for (let i = params.length - 1; i >= 0; i--) {
      const val = escapeSqlParam(params[i]);
      const placeholder = `$${i + 1}`;
      // Only replace whole placeholders (not partial matches like $12 when looking for $1)
      // We process from highest to lowest, so $10 is replaced before $1
      query = query.split(placeholder).join(val);
    }

    // Safety: reject multi-statement queries at runtime
    const normalized = query.replace(/'[^']*'/g, "''").toLowerCase();
    const statements = normalized.split(";").filter((s) => s.trim().length > 0);
    if (statements.length > 1) {
      throw new Error("Multi-statement queries are not allowed via pgQuery");
    }

    const { data, error } = await (getSupabase() as any).rpc("exec_sql", { sql_query: query });
    if (error) throw error;
    const rows = (data as any[] | null) ?? [];
    return rows as T[];
  } catch (e) {
    let err: string;
    if (e instanceof Error) {
      err = e.message;
    } else if (typeof e === "object" && e !== null) {
      err = JSON.stringify(e);
    } else {
      err = String(e);
    }
    console.error("[pgQuery] ERROR", { text: text.slice(0, 200), error: err });
    throw e;
  }
}

export async function pgOne<T = unknown>(
  text: string,
  params: ReadonlyArray<unknown> = [],
): Promise<T | null> {
  const rows = await pgQuery<T>(text, params);
  return rows[0] ?? null;
}

type PgClientLike = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>;
};

export async function withClient<T>(
  fn: (c: PgClientLike) => Promise<T>,
): Promise<T> {
  const client: PgClientLike = {
    query: async (text: string, params?: unknown[]) => {
      const upper = text.trim().toLowerCase();
      if (
        upper === "begin" ||
        upper.startsWith("begin ") ||
        upper === "commit" ||
        upper.startsWith("commit ") ||
        upper === "rollback" ||
        upper.startsWith("rollback ")
      ) {
        return { rows: [] };
      }
      const rows = await pgQuery(text, params ?? []);
      return { rows: rows as unknown[] };
    },
  };
  return await fn(client);
}
