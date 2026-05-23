import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { isServer } from "@/lib/auth-helpers";
import { useEffect, useState } from "react";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { checkMemberAccess } from "@/lib/access-check.functions";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    // Skip auth check during SSR — supabase client uses localStorage.
    // Client-side hydration will re-run beforeLoad and redirect if needed.
    if (isServer()) return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href } as never,
      });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const checkFn = useAuthedServerFn(checkMemberAccess);
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    checkFn()
      .then((res) => {
        if (cancelled) return;
        if (!res.allowed) {
          supabase.auth.signOut().then(() => {
            window.location.href = "/login";
          });
          return;
        }
        setAllowed(true);
        setChecking(false);
      })
      .catch(() => {
        if (cancelled) return;
        supabase.auth.signOut().then(() => {
          window.location.href = "/login";
        });
      });
    return () => { cancelled = true; };
  }, [checkFn]);

  if (checking) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">Acesso negado</p>
          <p className="text-sm text-muted-foreground">Não tens permissão para aceder.</p>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
