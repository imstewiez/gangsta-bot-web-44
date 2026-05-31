import { useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

const VIEW_AS_STORAGE_KEY = "ballas.viewAsMemberId";

export function getViewAsMemberId(): string | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(VIEW_AS_STORAGE_KEY);
  return value && /^\d+$/.test(value) ? value : null;
}

export function setViewAsMemberId(memberId: string | null) {
  if (typeof window === "undefined") return;
  if (memberId && /^\d+$/.test(memberId)) window.localStorage.setItem(VIEW_AS_STORAGE_KEY, memberId);
  else window.localStorage.removeItem(VIEW_AS_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("ballas:view-as-changed"));
}

/**
 * Wrapper around useServerFn that explicitly attaches the Supabase auth
 * Bearer token to every call. Also attaches a safe admin-only view-as header
 * so chefia can audit permissions/prices as another member without changing auth.
 */
export function useAuthedServerFn<TFn extends (...args: any[]) => any>(
  serverFn: TFn
): TFn {
  const base = useServerFn(serverFn);

  return useCallback(
    async (opts?: any): Promise<any> => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const viewAsMemberId = getViewAsMemberId();

      return (base as any)({
        ...(opts ?? {}),
        headers: {
          ...(opts?.headers ?? {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(viewAsMemberId ? { "x-view-as-member-id": viewAsMemberId } : {}),
        },
      });
    },
    [base]
  ) as TFn;
}
