// Server-only PostgreSQL pool for the existing Railway database (Bot di Zona).
// NEVER import this file from client code.
import { Pool, type PoolClient } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not configured");
    }
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30_000,
    });
  }
  return pool;
}

export async function pgQuery<T = unknown>(
  text: string,
  params: ReadonlyArray<unknown> = [],
): Promise<T[]> {
  const res = await getPool().query(text, params as unknown[]);
  return res.rows as T[];
}

export async function pgOne<T = unknown>(
  text: string,
  params: ReadonlyArray<unknown> = [],
): Promise<T | null> {
  const rows = await pgQuery<T>(text, params);
  return rows[0] ?? null;
}

export async function withClient<T>(
  fn: (c: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}
