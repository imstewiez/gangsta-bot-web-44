import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { listAppUsers, setUserRole, checkSuperAdminAccess } from "@/lib/admin.functions";

import { PageHeader } from "@/components/layout/AppShell";
import { ButtonLoading } from "@/components/ui/ButtonLoading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDate } from "@/lib/domain";
import { toast } from "sonner";
import { Shield, ShieldOff, Crown } from "lucide-react";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { EmptyState } from "@/components/layout/EmptyState";
import { Loader2 } from "lucide-react";
import { PageErrorBoundary } from "@/components/layout/PageErrorBoundary";
import { Reveal } from "@/components/layout/Reveal";

export const Route = createFileRoute("/_authenticated/admin/")({
  errorComponent: PageErrorBoundary,
  head: () => ({
    meta: [{ title: "Definições | Ballas Gang" }],
  }),
  component: AdminIndexPage,
});

function AdminIndexPage() {
  const superFn = useAuthedServerFn(checkSuperAdminAccess);
  const superCheck = useQuery({ queryKey: ["superAdminCheck"], queryFn: () => superFn() });
  const listFn = useAuthedServerFn(listAppUsers);
  const setFn = useAuthedServerFn(setUserRole);
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["appUsers"], queryFn: () => listFn() });

  const isCallerSuper = superCheck.data?.is_superadmin ?? false;

  const m = useMutation({
    mutationFn: (v: {
      user_id: string;
      role: "superadmin" | "admin" | "member";
      grant: boolean;
    }) => setFn({ data: v }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["appUsers"] });
      const prev = qc.getQueryData(["appUsers"]);
      qc.setQueryData(["appUsers"], (old: any) =>
        old?.map((u: any) =>
          u.user_id === vars.user_id
            ? {
                ...u,
                roles: vars.grant
                  ? [...new Set([...u.roles, vars.role])]
                  : u.roles.filter((r: string) => r !== vars.role),
              }
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

  if (superCheck.isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <>
      <PageHeader
        eyebrow="Direção"
        title="Definições"
        description="Gerir permissões e sincronizar dados"
      />
      <Reveal direction="up" delay={150}>
        <Card className="interactive-card">
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
                const isSuper = u.roles.includes("superadmin");

                const canToggleSuper = isCallerSuper;
                const canToggleAdmin = isCallerSuper && !isSuper;

                return (
                  <div
                    key={u.user_id}
                    className="flex items-center gap-3 rounded-sm border border-border p-3 interactive-row"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {u.display_name ?? "(sem nome)"}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {u.discord_id ?? u.user_id.slice(0, 8)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        desde {fmtDate(u.created_at)}
                      </div>
                    </div>
                    <div className="flex gap-2 text-xs flex-wrap justify-end">
                      {isSuper && (
                        <span className="rounded-sm px-2 py-1 text-display bg-amber-500/20 text-amber-500 border border-amber-500/30">
                          <Crown className="inline h-3 w-3 mr-1" />
                          superadmin
                        </span>
                      )}
                      {isAdmin && !isSuper && (
                        <span className="rounded-sm px-2 py-1 text-display bg-primary/20 text-primary border border-primary/30">
                          <Shield className="inline h-3 w-3 mr-1" />
                          admin
                        </span>
                      )}
                      {!isAdmin && !isSuper && (
                        <span className="rounded-sm px-2 py-1 text-display bg-muted">
                          member
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {canToggleSuper && (
                        <ButtonLoading
                          size="sm"
                          loading={m.isPending}
                          variant={isSuper ? "outline" : "default"}
                          disabled={m.isPending}
                          onClick={() =>
                            m.mutate({
                              user_id: u.user_id,
                              role: "superadmin",
                              grant: !isSuper,
                            })
                          }
                        >
                          {isSuper ? (
                            <>
                              <ShieldOff className="mr-1 h-3 w-3" />
                              Remover super
                            </>
                          ) : (
                            <>
                              <Crown className="mr-1 h-3 w-3" />
                              Tornar super
                            </>
                          )}
                        </ButtonLoading>
                      )}
                      {canToggleAdmin && (
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
                      )}
                    </div>
                  </div>
                );
              })}
              {!users.isLoading && !users.data?.length && (
                <EmptyState title="Nenhum utilizador" description="Ainda não existem utilizadores registados." />
              )}
            </div>
          </CardContent>
        </Card>
      </Reveal>
    </>
  );
}
