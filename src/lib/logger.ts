import { pgQuery } from "./pg.server";

export async function logToDb(
  level: "info" | "warn" | "error",
  source: string,
  message: string,
  details?: Record<string, unknown>,
) {
  try {
    await pgQuery(
      `INSERT INTO app_logs (level, source, message, details, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [level, source, message, details ? JSON.stringify(details) : null],
    );
  } catch {
    // Fallback: console se DB falhar
    console[level](`[${source}] ${message}`, details);
  }
}

export async function getRecentLogs(
  level?: string,
  limit: number = 50,
) {
  const where = level ? "WHERE level = $2" : "";
  const params = level ? [limit, level] : [limit];
  return pgQuery<{
    id: number;
    level: string;
    source: string;
    message: string;
    details: unknown;
    created_at: string;
  }>(
    `SELECT id, level, source, message, details, created_at
     FROM app_logs
     ${where}
     ORDER BY created_at DESC
     LIMIT $1`,
    params,
  );
}
