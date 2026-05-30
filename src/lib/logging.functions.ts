import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgOne, pgQuery } from "./pg.server";
import { logger } from "./logger.server";
import { z } from "zod";

// ============================================================================
// AUDIT LOGS — business actions (who did what, when)
// ============================================================================

export type AuditAction =
  // Members
  | "member_promoted" | "member_demoted" | "member_kicked" | "member_joined"
  | "member_left" | "member_renamed" | "member_tier_set" | "member_stats_adjusted"
  // Orders
  | "order_created" | "order_approved" | "order_denied" | "order_fulfilled"
  | "order_cancelled" | "order_updated"
  // Deliveries
  | "delivery_created" | "delivery_approved" | "delivery_rejected"
  | "delivery_request_created" | "delivery_request_approved"
  // Stock
  | "inventory_in" | "inventory_out" | "inventory_adjusted"
  | "bairrista_submission" | "item_created" | "item_updated" | "item_deleted"
  // Operations
  | "operation_created" | "operation_started" | "operation_finalized"
  | "operation_closed" | "operation_cancelled" | "operation_liquidated"
  // Prizes
  | "prize_set" | "prize_delivered"
  // Tags
  | "tag_request" | "tag_approved" | "tag_denied"
  // System
  | "rankings_recomputed" | "settings_changed" | "auth_login" | "auth_logout"
  | string;

export type AuditCategory =
  | "membro" | "encomenda" | "entrega" | "stock" | "saída"
  | "prémio" | "tag" | "sistema" | "outro";

export interface AuditLogEntry {
  action: AuditAction;
  entity_type?: string | null;
  entity_id?: string | null;
  actor_id?: string | null;
  actor_name?: string | null;
  context?: string | null;
  after_state?: Record<string, unknown> | null;
}

export async function logAuditAction(
  supabase: any,
  entry: AuditLogEntry
): Promise<void> {
  try {
    await supabase.from("audit_logs").insert({
      action: entry.action,
      entity_type: entry.entity_type ?? null,
      entity_id: entry.entity_id ?? null,
      actor_id: entry.actor_id ?? null,
      actor_name: entry.actor_name ?? null,
      context: entry.context ?? null,
      after_state: entry.after_state ?? null,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    logger.error("logAuditAction_failed", {
      action: entry.action,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function logAdminAction(
  supabase: any,
  opts: {
    action: AuditAction;
    actorId: string;
    actorName: string;
    targetType?: string;
    targetId?: string | number;
    details?: string;
    afterState?: Record<string, unknown>;
  }
): Promise<void> {
  await logAuditAction(supabase, {
    action: opts.action,
    entity_type: opts.targetType ?? null,
    entity_id: opts.targetId != null ? String(opts.targetId) : null,
    actor_id: opts.actorId,
    actor_name: opts.actorName,
    context: opts.details ?? null,
    after_state: opts.afterState ?? null,
  });
}

// ============================================================================
// APP LOGS — technical logs (errors, warnings, system events)
// ============================================================================

export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug";
export type LogSource = "web" | "discord-bot" | "cron" | "worker" | "system";
export type LogCategory =
  | "auth" | "db" | "api" | "system" | "discord" | "business"
  | "cache" | "sync" | "security";

export interface AppLogEntry {
  level: LogLevel;
  source?: LogSource;
  category?: LogCategory;
  message: string;
  metadata?: Record<string, unknown>;
  errorStack?: string;
  userId?: string;
  requestId?: string;
}

export async function logAppEvent(
  supabase: any,
  entry: AppLogEntry
): Promise<void> {
  try {
    await supabase.from("app_logs").insert({
      level: entry.level,
      source: entry.source ?? "web",
      category: entry.category ?? "system",
      message: entry.message,
      metadata: entry.metadata ?? {},
      error_stack: entry.errorStack ?? null,
      user_id: entry.userId ?? null,
      request_id: entry.requestId ?? null,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    // Fallback to console only — don't loop on logging failures
    logger.error("logAppEvent_failed", {
      message: entry.message,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export async function captureError(
  supabase: any,
  error: unknown,
  context?: {
    source?: LogSource;
    category?: LogCategory;
    userId?: string;
    requestId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const err = error instanceof Error ? error : new Error(String(error));
  await logAppEvent(supabase, {
    level: "error",
    source: context?.source ?? "web",
    category: context?.category ?? "system",
    message: err.message,
    errorStack: err.stack ?? undefined,
    userId: context?.userId,
    requestId: context?.requestId,
    metadata: {
      ...context?.metadata,
      name: err.name,
    },
  });
}

// ============================================================================
// SERVER FUNCTIONS — exposed for pages / cron jobs
// ============================================================================

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<any[]> => {
    const rows = await pgQuery<{
      id: number;
      action: string;
      entity_type: string | null;
      entity_id: string | null;
      actor_id: string | null;
      actor_name: string | null;
      context: string | null;
      after_state: Record<string, unknown> | null;
      created_at: string;
    }>(
      `select id, action, entity_type, entity_id, actor_id, actor_name, context, after_state, created_at
       from audit_logs
       order by created_at desc
       limit 1000`,
    );
    return rows;
  });

export const listAppLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<any[]> => {
    const rows = await pgQuery<{
      id: number;
      level: string;
      source: string;
      category: string;
      message: string;
      metadata: Record<string, unknown> | null;
      error_stack: string | null;
      user_id: string | null;
      request_id: string | null;
      created_at: string;
    }>(
      `select id, level, source, category, message, metadata, error_stack, user_id, request_id, created_at
       from app_logs
       order by created_at desc
       limit 1000`,
    );
    return rows;
  });

const AppLogFilterSchema = z.object({
  level: z.string().optional(),
  category: z.string().optional(),
  source: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
});

export const listAppLogsFiltered = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => AppLogFilterSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const limit = Math.min(data.limit ?? 100, 500);
    const offset = data.offset ?? 0;
    const conditions: string[] = [];
    const params: (string | number)[] = [];
    let pidx = 1;

    if (data.level) {
      conditions.push(`level = $${pidx++}`);
      params.push(data.level);
    }
    if (data.category) {
      conditions.push(`category = $${pidx++}`);
      params.push(data.category);
    }
    if (data.source) {
      conditions.push(`source = $${pidx++}`);
      params.push(data.source);
    }
    if (data.search) {
      conditions.push(`(message ilike $${pidx} or metadata::text ilike $${pidx})`);
      params.push(`%${data.search}%`);
      pidx++;
    }

    const where = conditions.length ? `where ${conditions.join(" and ")}` : "";
    const countRow = await pgOne<any>(
      `select count(*)::int as count from app_logs ${where}`,
      params,
    );
    const rows = await pgQuery<any>(
      `select id, level, source, category, message, metadata, error_stack, user_id, request_id, created_at
       from app_logs ${where}
       order by created_at desc
       limit $${pidx++} offset $${pidx++}`,
      [...params, limit, offset],
    );
    return { rows, total: countRow?.count ?? 0 };
  });

export const getLogStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const totalAudit = await pgOne<{ count: number }>(
      `select count(*)::int as count from audit_logs`,
    );
    const totalApp = await pgOne<{ count: number }>(
      `select count(*)::int as count from app_logs`,
    );
    const errors24h = await pgOne<{ count: number }>(
      `select count(*)::int as count from app_logs where level = 'error' and created_at > now() - interval '24 hours'`,
    );
    const errors7d = await pgOne<{ count: number }>(
      `select count(*)::int as count from app_logs where level = 'error' and created_at > now() - interval '7 days'`,
    );
    const topErrorCategories = await pgQuery<{ category: string; count: number }>(
      `select category, count(*)::int as count from app_logs where level = 'error' and created_at > now() - interval '7 days' group by category order by count desc limit 5`,
    );
    return {
      totalAudit: totalAudit?.count ?? 0,
      totalApp: totalApp?.count ?? 0,
      errors24h: errors24h?.count ?? 0,
      errors7d: errors7d?.count ?? 0,
      topErrorCategories: topErrorCategories ?? [],
    };
  });
