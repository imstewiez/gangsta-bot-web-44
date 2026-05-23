import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { supabase } from "@/integrations/supabase/client";
import { isServer } from "@/lib/auth-helpers";
import { checkManagerAccess } from "@/lib/access-check.functions";
import { listAppUsers, setUserRole } from "@/lib/admin.functions";
import { adminRecalcAllTimeStats, adminImportMissingMembers } from "@/lib/member-admin.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { ButtonLoading } from "@/components/ui/ButtonLoading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtDate } from "@/lib/domain";
import { toast } from "sonner";
import { Shield, ShieldOff, Calculator, Users } from "lucide-react";
import { PageSkeleton, TableSkeleton, CardGridSkeleton } from "@/components/layout/PageSkeleton";
import { EmptyState } from "@/components/layout/EmptyState";
import { Loader2 } from "lucide-react";
import { PageErrorBoundary } from "@/components/layout/PageErrorBoundary";

export const Route = createFileRoute("/_authenticated/admin")({
  errorComponent: PageErrorBoundary,
  beforeLoad: async () => {
    if (isServer()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
  },
  head: () => ({
    meta: [{ title: "Definições | Ballas Gang" }],
  }),
  component: AdminPage,
});

function AdminPage() {
  const managerFn = useAuthedServerFn(checkManagerAccess);
  const managerCheck = useQuery({ queryKey: ["managerCheck"], queryFn: () => managerFn() });
  const listFn = useAuthedServerFn(listAppUsers);
  const setFn = useAuthedServerFn(setUserRole);
  const recalcFn = useAuthedServerFn(adminRecalcAllTimeStats);
  const importFn = useAuthedServerFn(adminImportMissingMembers);
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["appUsers"], queryFn: () => listFn() });
  const recalcM = useMutation({
    mutationFn: () => recalcFn(),
    onSuccess: (res) => {
      toast.success(`all_time_stats recalculado — ${res.rows_updated} membros atualizados`);
      qc.invalidateQueries({ queryKey: ["membersWithStats"] });
      qc.invalidateQueries({ queryKey: ["member"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const importM = useMutation({
    mutationFn: () => importFn(),
    onSuccess: (res) => {
      toast.success(`${res.created} membros importados (${res.totalMissing} em falta)`);
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["appUsers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
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

  if (managerCheck.isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
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
  return (
    <>
      <PageHeader
        eyebrow="Direção"
        title="Definições"
        description="Gerir permissões e sincronizar dados"
      />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-display text-sm">
            Sincronização de dados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Recalcula <code className="text-xs bg-muted px-1 rounded">all_time_stats</code> a partir das tabelas fonte
              (kill_logs, operations, inventory_movements, orders). Use isto se os kills ou stats de um membro
              parecerem desactualizados no perfil vs leaderboard.
            </p>
            <ButtonLoading
              size="sm"
              loading={recalcM.isPending}
              onClick={() => recalcM.mutate()}
            >
              <Calculator className="mr-1 h-3 w-3" />
              Recalcular all_time_stats
            </ButtonLoading>
          </div>
          <div className="border-t border-border pt-4">
            <p className="text-sm text-muted-foreground mb-3">
              Importa membros que fizeram login na app (têm perfil Discord) mas ainda não têm registo na tabela
              <code className="text-xs bg-muted px-1 rounded">members</code>. Isto acontece quando alguém entra no
              Discord e faz login na app antes de ser aprovado no onboarding.
            </p>
            <ButtonLoading
              size="sm"
              loading={importM.isPending}
              onClick={() => importM.mutate()}
            >
              <Users className="mr-1 h-3 w-3" />
              Importar membros em falta
            </ButtonLoading>
          </div>
        </CardContent>
      </Card>

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
                  className="flex items-center gap-3 rounded-sm border border-border p-3 interactive-row"
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
              <EmptyState title="Nenhum utilizador" description="Nenhum utilizador" />
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
