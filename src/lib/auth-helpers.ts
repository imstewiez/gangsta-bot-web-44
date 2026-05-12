// Auth helpers for TanStack Start routes.
// Supabase client uses localStorage, so getSession/getUser fail during SSR.
// We skip auth checks on the server and let the client-side hydration handle redirects.

export const IS_SSR = typeof window === "undefined";

/**
 * Returns true if we're running on the server (SSR/prerender).
 * Use this to skip localStorage-dependent auth checks in beforeLoad.
 */
export function isServer(): boolean {
  return IS_SSR;
}
