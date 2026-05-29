// Distributed rate limiter for Cloudflare Workers.
// Uses Upstash Redis when available; falls back to in-memory Map for local dev.
// NEVER import from client code.

import { Redis } from "@upstash/redis";
import { logger } from "./logger.server";

// ---------------------------------------------------------------------------
// Redis client (lazy init)
// ---------------------------------------------------------------------------
let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;

  const url = getEnvVar("UPSTASH_REDIS_REST_URL");
  const token = getEnvVar("UPSTASH_REDIS_REST_TOKEN");

  if (!url || !token) {
    return null;
  }

  try {
    redis = new Redis({ url, token });
    return redis;
  } catch (e) {
    logger.error("redis_init_failed", { error: String(e) });
    return null;
  }
}

function getEnvVar(name: string): string | undefined {
  // Cloudflare Workers env via globalThis, else Node process.env
  const env = (globalThis as any).__cloudflareEnv as Record<string, string> | undefined;
  return env?.[name] ?? process.env[name];
}

// ---------------------------------------------------------------------------
// In-memory fallback
// ---------------------------------------------------------------------------
type MemoryEntry = { count: number; resetAt: number };
const memoryStore = new Map<string, MemoryEntry>();

function memoryRateLimit(
  key: string,
  windowMs: number,
  max: number,
): { allowed: boolean; limit: number; remaining: number; retryAfter: number } {
  const now = Date.now();

  // Periodic cleanup (1% chance per request)
  if (Math.random() < 0.01) {
    for (const [k, entry] of memoryStore.entries()) {
      if (entry.resetAt <= now) memoryStore.delete(k);
    }
  }

  const entry = memoryStore.get(key);
  if (!entry || entry.resetAt <= now) {
    const newEntry: MemoryEntry = { count: 1, resetAt: now + windowMs };
    memoryStore.set(key, newEntry);
    return { allowed: true, limit: max, remaining: max - 1, retryAfter: 0 };
  }

  if (entry.count >= max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, limit: max, remaining: 0, retryAfter };
  }

  entry.count++;
  return { allowed: true, limit: max, remaining: max - entry.count, retryAfter: 0 };
}

// ---------------------------------------------------------------------------
// Redis distributed rate limit (fixed window with TTL)
// ---------------------------------------------------------------------------
async function redisRateLimit(
  key: string,
  windowMs: number,
  max: number,
): Promise<{ allowed: boolean; limit: number; remaining: number; retryAfter: number }> {
  const r = getRedis();
  if (!r) {
    return memoryRateLimit(key, windowMs, max);
  }

  const windowKey = `${key}:${Math.floor(Date.now() / windowMs)}`;
  const windowSeconds = Math.ceil(windowMs / 1000);

  try {
    const current = await r.incr(windowKey);
    if (current === 1) {
      await r.expire(windowKey, windowSeconds);
    }

    const remaining = Math.max(0, max - current);
    const allowed = current <= max;
    const retryAfter = allowed ? 0 : windowSeconds;

    return { allowed, limit: max, remaining, retryAfter };
  } catch (e) {
    logger.error("redis_rate_limit_failed", { key: key.slice(0, 50), error: String(e) });
    // Fail open — fallback to memory so requests don't get hard-blocked on Redis outage
    return memoryRateLimit(key, windowMs, max);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export type RateLimitConfig = {
  windowMs: number;
  max: number;
  keyGenerator?: (request: Request) => string;
  skipSuccessfulRequests?: boolean;
};

function defaultKeyGenerator(request: Request): string {
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for") ?? "anonymous";
  return `${request.method}:${new URL(request.url).pathname}:${ip}`;
}

export async function rateLimit(
  request: Request,
  config: RateLimitConfig,
): Promise<{ allowed: boolean; limit: number; remaining: number; retryAfter: number }> {
  const key = (config.keyGenerator ?? defaultKeyGenerator)(request);
  const result = await redisRateLimit(key, config.windowMs, config.max);

  if (!result.allowed) {
    logger.warn("rate_limit_exceeded", {
      key: key.slice(0, 80),
      path: new URL(request.url).pathname,
      retryAfter: result.retryAfter,
      backend: getRedis() ? "redis" : "memory",
    });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Pre-configured limiters
// ---------------------------------------------------------------------------
export const cronRateLimiter: RateLimitConfig = {
  windowMs: 60_000, // 1 minute
  max: 5,
  keyGenerator: (req) => {
    const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "anonymous";
    return `cron:${ip}`;
  },
};

export const apiRateLimiter: RateLimitConfig = {
  windowMs: 60_000, // 1 minute
  max: 120,
  keyGenerator: (req) => {
    const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "anonymous";
    return `api:${ip}:${new URL(req.url).pathname}`;
  },
};

export const authRateLimiter: RateLimitConfig = {
  windowMs: 60_000, // 1 minute
  max: 10,
  keyGenerator: (req) => {
    const ip = req.headers.get("cf-connecting-ip") ?? req.headers.get("x-forwarded-for") ?? "anonymous";
    return `auth:${ip}`;
  },
};
