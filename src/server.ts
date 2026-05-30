import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { doRecalcWeeklyRankings } from "./lib/data-recovery.functions";
import { logger } from "./lib/logger.server";
import { rateLimit, cronRateLimiter, apiRateLimiter } from "./lib/rate-limit.server";

type ServerEntry = {
  fetch: (
    request: Request,
    env: unknown,
    ctx: unknown,
  ) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) =>
        (m as { default?: ServerEntry }).default ??
        (m as unknown as ServerEntry),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function jsonErrorResponse(status: number, message: string): Response {
  return Response.json({ success: false, error: message }, { status });
}

function isCatastrophicSsrErrorBody(
  body: string,
  responseStatus: number,
): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(
  response: Response,
): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  const err = consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`);
  logger.error("ssr_catastrophic_error", { message: err.message, status: response.status });
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const url = new URL(request.url);
    const startTime = Date.now();

    // Set global env for downstream functions
    (globalThis as any).__cloudflareEnv = env;

    // Health check endpoint (must be before rate limiting to allow monitoring)
    if (url.pathname === "/api/health") {
      return Response.json({
        status: "ok",
        service: "gangsta-web",
        timestamp: new Date().toISOString(),
        uptime: "unknown", // Workers don't expose process.uptime
      });
    }

    // Cron endpoint for external triggers (bot, etc)
    if (url.pathname === "/api/cron/recalc") {
      const rl = await rateLimit(request, cronRateLimiter);
      if (!rl.allowed) {
        return new Response("Rate limit exceeded", {
          status: 429,
          headers: { "Retry-After": String(rl.retryAfter) },
        });
      }

      const secret = request.headers.get("x-cron-secret");
      const expected = (env as any).CRON_SECRET || process.env.CRON_SECRET;
      if (!secret || secret !== expected) {
        logger.warn("cron_unauthorized", { path: url.pathname, ip: request.headers.get("cf-connecting-ip") });
        return new Response("Unauthorized", { status: 401 });
      }
      try {
        const result = await doRecalcWeeklyRankings();
        logger.info("cron_recalc_success", { ...result });
        return Response.json({ success: true, ...result });
      } catch (e) {
        logger.error("cron_recalc_failed", { error: String(e) });
        return jsonErrorResponse(500, String(e));
      }
    }

    // Redirect old domain to new domain
    if (url.hostname === "ballasgang.pt" || url.hostname === "www.ballasgang.pt") {
      url.hostname = "ballasgang.eu";
      url.protocol = "https:";
      return Response.redirect(url.toString(), 308);
    }

    // Apply API rate limiting to server function calls (exclude static assets)
    const isApiCall = url.pathname.startsWith("/__server") || url.pathname.startsWith("/api/");
    if (isApiCall) {
      const rl = await rateLimit(request, apiRateLimiter);
      if (!rl.allowed) {
        return new Response("Rate limit exceeded", {
          status: 429,
          headers: {
            "Retry-After": String(rl.retryAfter),
            "X-RateLimit-Limit": String(rl.limit),
            "X-RateLimit-Remaining": String(rl.remaining),
          },
        });
      }
    }

    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const duration = Date.now() - startTime;

      if (response.status >= 500) {
        logger.error("request_server_error", {
          path: url.pathname,
          status: response.status,
          durationMs: duration,
        });
      } else if (duration > 5000) {
        logger.warn("request_slow", {
          path: url.pathname,
          status: response.status,
          durationMs: duration,
        });
      } else {
        logger.debug("request_complete", {
          path: url.pathname,
          status: response.status,
          durationMs: duration,
        });
      }

      const normalized = await normalizeCatastrophicSsrResponse(response);
      // Prevent browser/CDN from caching HTML pages — always fetch fresh chunks
      const htmlResponse = new Response(normalized.body, {
        status: normalized.status,
        statusText: normalized.statusText,
        headers: new Headers(normalized.headers),
      });
      const contentType = htmlResponse.headers.get("content-type") ?? "";
      if (contentType.includes("text/html")) {
        htmlResponse.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
        htmlResponse.headers.set("Pragma", "no-cache");
        htmlResponse.headers.set("Expires", "0");
      }
      return htmlResponse;
    } catch (error) {
      logger.error("request_unhandled_exception", {
        path: url.pathname,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return brandedErrorResponse();
    }
  },

  async scheduled(controller: any, env: unknown, ctx: unknown) {
    (globalThis as any).__cloudflareEnv = env;
    logger.info("scheduled_recalc_start", { timestamp: new Date().toISOString() });
    try {
      const result = await doRecalcWeeklyRankings();
      logger.info("scheduled_recalc_success", { ...result });
    } catch (e) {
      logger.error("scheduled_recalc_failed", { error: String(e) });
    }
  },
};
