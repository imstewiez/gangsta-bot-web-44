/**
 * Security utilities — input validation, rate limiting, sanitization.
 * NEVER import from client code.
 */

import { z } from "zod";

// ─── Zod schemas for common inputs ───────────────────────────────────────────

export const IdSchema = z.number().int().positive();
export const StatusSchema = z.string().max(50).nullable().optional();

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


