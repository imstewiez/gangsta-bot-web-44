/**
 * Security utilities — input validation, rate limiting, sanitization.
 * NEVER import from client code.
 */

import { z } from "zod";

// ─── Zod schemas for common inputs ───────────────────────────────────────────

export const IdSchema = z.number().int().positive();
export const LimitSchema = z.number().int().min(1).max(500).optional();
export const WeekStartSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();
export const StatusSchema = z.string().max(50).nullable().optional();

// ─── Rate limiting (in-memory, per-Worker instance) ──────────────────────────

const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 60;

export function checkRateLimit(key: string): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const entry = rateMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { ok: true, retryAfter: 0 };
  }

  if (entry.count >= RATE_MAX_REQUESTS) {
    return { ok: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  return { ok: true, retryAfter: 0 };
}

// ─── SQL injection helpers ───────────────────────────────────────────────────

/** Prevent multi-statement and dangerous SQL keywords in dynamic fragments. */
export function validateSafeSqlFragment(fragment: string): string {
  const normalized = fragment.trim().toLowerCase();
  const dangerous = [
    ";", "--", "/*", "*/", "drop ", "delete ", "truncate ", "grant ", "revoke ",
    "alter ", "create ", "exec(", "execute(", "xp_", "sp_", "union ", "union\t",
  ];
  for (const bad of dangerous) {
    if (normalized.includes(bad)) {
      throw new Error(`Unsafe SQL fragment detected: ${bad}`);
    }
  }
  return fragment;
}

/** Robust param escaping for exec_sql RPC (fallback until native params work). */
export function escapeSqlParam(param: unknown): string {
  if (param === null || param === undefined) return "NULL";
  if (typeof param === "boolean") return param ? "TRUE" : "FALSE";
  if (typeof param === "number") {
    if (!Number.isFinite(param)) throw new Error("Invalid numeric parameter");
    return String(param);
  }
  if (param instanceof Date) return `'${param.toISOString().replace(/'/g, "''")}'`;
  if (typeof param === "string") {
    // Reject strings that look like SQL injection attempts
    if (/\0/.test(param)) throw new Error("Null byte in string parameter");
    return `E'${param.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
  }
  if (Array.isArray(param)) {
    return `ARRAY[${param.map(escapeSqlParam).join(",")}]`;
  }
  throw new Error(`Unsupported SQL parameter type: ${typeof param}`);
}

// ─── Admin authorization guard ───────────────────────────────────────────────

export function assertAdmin(roles: string[]): void {
  if (!roles.includes("admin")) {
    throw new Response("Acesso negado: permissão de administrador necessária.", { status: 403 });
  }
}

export function assertManager(isManager: boolean): void {
  if (!isManager) {
    throw new Response("Acesso negado: permissão de chefia necessária.", { status: 403 });
  }
}
