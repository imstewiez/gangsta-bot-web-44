import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { supabase } from "@/integrations/supabase/client";
import { isServer } from "@/lib/auth-helpers";
import { checkManagerAccess } from "@/lib/access-check.functions";
import { Loader2 } from "lucide-react";
import { PageErrorBoundary } from "@/components/layout/PageErrorBoundary";

export const Route = createFileRoute("/_authenticated/admin")({
  errorComponent: PageErrorBoundary,
  beforeLoad: async () => {
    if (isServer()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
  },
  component: AdminLayout,
});

function AdminLayout() {
  const managerFn = useAuthedServerFn(checkManagerAccess);
  const managerCheck = useQuery({ queryKey: ["managerCheck"], queryFn: () => managerFn() });

  if (managerCheck.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!managerCheck.data?.allowed) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold">Acesso restrito</p>
          <p className="text-sm text-muted-foreground">Só a direção pode aceder a esta página.</p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
