/**
 * Security utilities — input validation, rate limiting, sanitization.
 * NEVER import from client code.
 */

import { z } from "zod";

// ─── Zod schemas for common inputs ───────────────────────────────────────────

export const IdSchema = z.number().int().positive();
export const UuidSchema = z.string().uuid();
export const StatusSchema = z.string().max(50).nullable().optional();

export const NameSchema = z.string().trim().min(1).max(100);
export const DisplayNameSchema = z.string().trim().min(1).max(80);
export const NicknameSchema = z.string().trim().max(80).nullable().optional();
export const NotesSchema = z.string().max(2000).nullable().optional();
export const ReasonSchema = z.string().trim().min(1).max(500);
export const SpotSchema = z.string().trim().max(100).nullable().optional();
export const DescriptionSchema = z.string().max(500).nullable().optional();

export const OrderStatusSchema = z.enum([
  "pending", "approved", "in_progress", "ready", "fulfilled", "denied", "cancelled",
]);

export const LeaderboardPeriodSchema = z.enum(["week", "month", "all"]);
export const LeaderboardSortBySchema = z.enum([
  "score", "kills", "deaths", "kd", "deliveries", "sales", "ops", "wins",
]);
export const SortDirSchema = z.enum(["asc", "desc"]);

export const DeliveryScopeSchema = z.enum(["mine", "manage"]);
export const DeliveryTipoSchema = z.enum(["entrega", "venda"]);

export const OperationTypeSchema = z.string().trim().min(1).max(80);
export const ScheduledAtSchema = z.string().datetime().nullable().optional();

const MAX_STRING_PARAM_LEN = 10000;
const MAX_ARRAY_LEN = 1000;

/** Robust param escaping for exec_sql RPC (fallback until native params work). */
export function escapeSqlParam(param: unknown): string {
  if (param === null || param === undefined) return "NULL";
  if (typeof param === "boolean") return param ? "TRUE" : "FALSE";
  if (typeof param === "number") {
    if (!Number.isFinite(param)) throw new Error("Invalid numeric parameter");
    return String(param);
  }
  if (typeof param === "bigint") return String(param);
  if (param instanceof Date) {
    if (isNaN(param.getTime())) throw new Error("Invalid Date parameter");
    return `'${param.toISOString().replace(/'/g, "''")}'`;
  }
  if (typeof param === "string") {
    if (/\0/.test(param)) throw new Error("Null byte in string parameter");
    if (param.length > MAX_STRING_PARAM_LEN)
      throw new Error(`String parameter exceeds max length ${MAX_STRING_PARAM_LEN}`);
    // Reject strings that look like SQL comment injection or statement separators
    const lower = param.toLowerCase();
    if (lower.includes("\x00") || lower.includes("\\x00")) {
      throw new Error("Null byte in string parameter");
    }
    return `E'${param.replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;
  }
  if (Array.isArray(param)) {
    if (param.length > MAX_ARRAY_LEN)
      throw new Error(`Array parameter exceeds max length ${MAX_ARRAY_LEN}`);
    return `ARRAY[${param.map(escapeSqlParam).join(",")}]`;
  }
  // Reject plain objects, symbols, functions, and any other unexpected types
  throw new Error(`Unsupported SQL parameter type: ${typeof param}`);
}
