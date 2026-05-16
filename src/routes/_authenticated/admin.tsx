import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { supabase } from "@/integrations/supabase/client";
import { isServer } from "@/lib/auth-helpers";
import { listAppUsers, setUserRole } from "@/lib/admin.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { ButtonLoading } from "@/components/ui/ButtonLoading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDate } from "@/lib/domain";
import { toast } from "sonner";
import { Shield, ShieldOff } from "lucide-react";
import { PageSkeleton, TableSkeleton, CardGridSkeleton } from "@/components/layout/PageSkeleton";
import { EmptyState } from "@/components/layout/EmptyState";
import { Loader2 } from "lucide-react";
import { PageErrorBoundary } from "@/components/layout/PageErrorBoundary";

export const Route = createFileRoute("/_authenticated/admin")({
  errorComponent: PageErrorBoundary,
  beforeLoad: async () => {
    if (isServer()) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const MANAGER_ROLES = new Set(["patrao_di_zona", "real_gangster", "og", "kingpin", "manda_chuva", "admin"]);
    if (!(roles ?? []).some((r: { role: string }) => MANAGER_ROLES.has(r.role))) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: AdminPage,
});

function AdminPage() {
  const listFn = useAuthedServerFn(listAppUsers);
  const setFn = useAuthedServerFn(setUserRole);
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["appUsers"], queryFn: () => listFn() });
  const m = useMutation({
    mutationFn: (v: {
      user_id: string;
      role: "admin" | "member";
      grant: boolean;
    }) => setFn({ data: v }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["appUsers"] });
      const prev = qc.getQueryData(["appUsers"]);
      qc.setQueryData(["appUsers"], (old: any) =>
        old?.map((u: any) =>
          u.user_id === vars.user_id
            ? { ...u, app_role: vars.grant ? vars.role : null }
            : u
        )
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["appUsers"], ctx.prev);
      toast.error(_e.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["appUsers"] });
      toast.success("Atualizado");
    },
  });
  return (
    <>
      <PageHeader
        eyebrow="Direção"
        title="Admin"
        description="Gestão de acessos e permissões."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-display text-sm">
            Utilizadores da app
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users.isLoading && (
            <PageSkeleton rows={6} />
          )}
          {users.error && (
            <p className="text-destructive text-sm">
              {(users.error as Error).message}
            </p>
          )}
          <div className="space-y-2">
            {(users.data ?? []).map((u) => {
              const isAdmin = u.roles.includes("admin");
              return (
                <div
                  key={u.user_id}
                  className="flex items-center gap-3 rounded-sm border border-border p-3"
                >
                  <div className="flex-1">
                    <div className="font-medium">
                      {u.display_name ?? "(sem nome)"}
                    </div>
                    <div className="text-xs text-muted-foreground font-mono">
                      {u.discord_id ?? u.user_id.slice(0, 8)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      desde {fmtDate(u.created_at)}
                    </div>
                  </div>
                  <div className="flex gap-2 text-xs">
                    {u.roles.map((r) => (
                      <span
                        key={r}
                        className={
                          "rounded-sm px-2 py-1 text-display " +
                          (r === "admin"
                            ? "bg-primary/20 text-primary"
                            : "bg-muted")
                        }
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                  <ButtonLoading
                    size="sm"
                    loading={m.isPending}
                    variant={isAdmin ? "outline" : "default"}
                    disabled={m.isPending}
                    onClick={() =>
                      m.mutate({
                        user_id: u.user_id,
                        role: "admin",
                        grant: !isAdmin,
                      })
                    }
                  >
                    {isAdmin ? (
                      <>
                        <ShieldOff className="mr-1 h-3 w-3" />
                        Remover admin
                      </>
                    ) : (
                      <>
                        <Shield className="mr-1 h-3 w-3" />
                        Tornar admin
                      </>
                    )}
                  </ButtonLoading>
                </div>
              );
            })}
            {!users.isLoading && !users.data?.length && (
              <EmptyState title="Sem utilizadores" description="Nenhuns utilizadores encontrados." />
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
