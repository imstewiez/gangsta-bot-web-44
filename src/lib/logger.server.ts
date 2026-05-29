// Structured JSON logger for Cloudflare Workers.
// NEVER import from client code.
//
// Usage:
//   logger.info("user_login", { userId: "123", tier: "kingpin" });
//   logger.error("db_query_failed", { error: err.message, query: "..." });
//   logger.warn("rate_limit_approaching", { ip, path });

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

function getMinLevel(): LogLevel {
  const env = (globalThis as any).__cloudflareEnv as Record<string, string> | undefined;
  const level = env?.LOG_LEVEL ?? process.env.LOG_LEVEL ?? "info";
  return level as LogLevel;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[getMinLevel()];
}

function log(level: LogLevel, event: string, meta?: Record<string, unknown>) {
  if (!shouldLog(level)) return;

  const payload: Record<string, unknown> = {
    level,
    event,
    timestamp: new Date().toISOString(),
    service: "gangsta-web",
    ...meta,
  };

  // Remove undefined values to keep logs clean
  for (const key of Object.keys(payload)) {
    if (payload[key] === undefined) delete payload[key];
  }

  const serialized = JSON.stringify(payload);

  switch (level) {
    case "debug":
      console.debug(serialized);
      break;
    case "info":
      console.info(serialized);
      break;
    case "warn":
      console.warn(serialized);
      break;
    case "error":
    case "fatal":
      console.error(serialized);
      break;
  }
}

export const logger = {
  debug: (event: string, meta?: Record<string, unknown>) => log("debug", event, meta),
  info: (event: string, meta?: Record<string, unknown>) => log("info", event, meta),
  warn: (event: string, meta?: Record<string, unknown>) => log("warn", event, meta),
  error: (event: string, meta?: Record<string, unknown>) => log("error", event, meta),
  fatal: (event: string, meta?: Record<string, unknown>) => log("fatal", event, meta),
};
