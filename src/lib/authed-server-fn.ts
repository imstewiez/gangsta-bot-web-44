import { useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

/**
 * Wrapper around useServerFn that explicitly attaches the Supabase auth
 * Bearer token to every call. The global functionMiddleware does not exist
 * in TanStack Start v1.167, and serverFns.fetch may not survive hydration,
 * so we attach the token manually at the call site.
 */
export function useAuthedServerFn<TFn extends (...args: any[]) => any>(
  serverFn: TFn
): TFn {
  const base = useServerFn(serverFn);

  return useCallback(
    async (opts?: any): Promise<any> => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;

      return (base as any)({
        ...(opts ?? {}),
        headers: {
          ...(opts?.headers ?? {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    },
    [base]
  ) as TFn;
}
