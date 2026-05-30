import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { isServer } from "@/lib/auth-helpers";
import { useEffect, useState } from "react";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { checkMemberAccess } from "@/lib/access-check.functions";
import { PageTransition } from "@/components/layout/PageTransition";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
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
  const [denyReason, setDenyReason] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    checkFn()
      .then((res) => {
        if (cancelled) return;
        if (!res.allowed) {
          setDenyReason(res.reason ?? "unknown");
          setAllowed(false);
          setChecking(false);
          return;
        }
        setAllowed(true);
        setChecking(false);
      })
      .catch(() => {
        if (cancelled) return;
        setDenyReason("error");
        setAllowed(false);
        setChecking(false);
      });
    return () => { cancelled = true; };
  }, [checkFn]);

  if (checking) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/30 blur-xl animate-pulse-glow" />
            <div className="relative h-10 w-10 rounded-full border-2 border-primary/60 border-t-primary animate-spin" />
          </div>
          <p className="text-display text-[10px] tracking-[0.3em] text-muted-foreground uppercase animate-rise">
            A verificar acesso
          </p>
        </div>
      </div>
    );
  }

  if (!allowed) {
    const reasonText =
      denyReason === "not_member"
        ? "Ainda não estás registado na firma. Entra no Discord e espera pela aprovação."
        : denyReason === "deleted"
          ? "A tua conta foi removida. Contacta a direção."
          : denyReason === "inactive"
            ? "A tua conta está inactiva. Contacta a direção."
            : denyReason === "no_discord"
              ? "Conta Discord não encontrada. Tenta novamente."
              : "Não tens permissão para aceder.";
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-center animate-rise max-w-sm px-4">
          <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-destructive/10 ring-1 ring-destructive/30">
            <span className="text-2xl">🚫</span>
          </div>
          <p className="text-lg font-semibold text-foreground">Acesso negado</p>
          <p className="text-sm text-muted-foreground mt-2">{reasonText}</p>
          <button
            onClick={() => {
              supabase.auth.signOut().then(() => {
                window.location.href = "/login";
              });
            }}
            className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Voltar a entrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <PageTransition>
        <Outlet />
      </PageTransition>
    </AppShell>
  );
}
