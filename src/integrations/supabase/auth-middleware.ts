// Server-side auth middleware for TanStack server functions.
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { getEnv } from "@/lib/env.server";

// Public project defaults. These are safe to expose and keep local/dev working
// when env injection is not available.
const DEFAULT_SUPABASE_URL = "https://zducvbkozxtacwzvggli.supabase.co";
const DEFAULT_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBiYXNlIiwicmVmIjoienBkdWN2Ymtvenh0YWN3enZnZ2xpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2MDAwMjcsImV4cCI6MjA5NDE3NjAyN30.Rf7AHVSigbdQxkvMSwHY2pDYgjoLyG2oqSAw4E-v2Lc";

export const requireSupabaseAuth = createMiddleware({
  type: "function",
}).server(async ({ next }) => {
  const SUPABASE_URL = getEnv("SUPABASE_URL", DEFAULT_SUPABASE_URL);
  const SUPABASE_PUBLISHABLE_KEY =
    getEnv("SUPABASE_PUBLISHABLE_KEY") ||
    getEnv("SUPABASE_ANON_KEY") ||
    DEFAULT_SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    const missing = [
      ...(!SUPABASE_URL ? ["SUPABASE_URL"] : []),
      ...(!SUPABASE_PUBLISHABLE_KEY ? ["SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY"] : []),
    ];
    throw new Response(`Missing Supabase environment variable(s): ${missing.join(", ")}.`, { status: 500 });
  }

  const request = getRequest();

  if (!request?.headers) {
    throw new Response("Unauthorized: No request headers available", {
      status: 401,
    });
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    throw new Response("Unauthorized: No authorization header provided", {
      status: 401,
    });
  }

  if (!authHeader.startsWith("Bearer ")) {
    throw new Response("Unauthorized: Only Bearer tokens are supported", {
      status: 401,
    });
  }

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) {
    throw new Response("Unauthorized: No token provided", { status: 401 });
  }

  const supabase = createClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new Response("Unauthorized: Invalid token", { status: 401 });
  }

  return next({
    context: {
      supabase,
      userId: data.user.id,
      claims: data.user,
    },
  });
});
