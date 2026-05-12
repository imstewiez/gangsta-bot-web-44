import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardKpis } from "@/lib/dashboard.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtNum, TIER_LABELS, type Tier } from "@/lib/domain";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  const fn = useServerFn(getDashboardKpis);
  const { profile } = useAuth();
  const { data, isLoading, error } = useQuery({ queryKey: ["dashboard"], queryFn: () => fn() });

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title={`Bom dia, ${profile?.display_name ?? "bairrista"}.`}
        description="Estado actual do bairro, em tempo real."
      />
      {error && <p className="text-destructive text-sm">Erro: {(error as Error).message}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Membros" value={data?.totalMembers} loading={isLoading} accent />
        <Kpi label="Saídas em aberto" value={data?.openSaidas} loading={isLoading} />
        <Kpi label="Tags pendentes" value={data?.pendingTagRequests} loading={isLoading} />
        <Kpi label="Stock total" value={data?.totalStock} loading={isLoading} />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-display text-sm">Por tier</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(data?.byTier ?? []).map((t) => (
                <li key={t.tier} className="flex items-center justify-between border-b border-border/50 py-2 last:border-0">
                  <span className="text-sm">{TIER_LABELS[t.tier as Tier] ?? t.tier}</span>
                  <span className="text-display text-lg">{fmtNum(t.count)}</span>
                </li>
              ))}
              {!data?.byTier?.length && !isLoading && <li className="text-sm text-muted-foreground">Sem dados.</li>}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-display text-sm">Top da semana</CardTitle></CardHeader>
          <CardContent>
            <ol className="space-y-2">
              {(data?.topWeek ?? []).map((m, i) => (
                <li key={i} className="flex items-center gap-3 border-b border-border/50 py-2 last:border-0">
                  <span className="text-display w-6 text-primary">{i + 1}</span>
                  <span className="text-sm font-medium">{m.display_name ?? m.nick ?? "—"}</span>
                  <span className="ml-auto text-display text-sm">{fmtNum(Math.round(m.score))}</span>
                </li>
              ))}
              {!data?.topWeek?.length && !isLoading && <li className="text-sm text-muted-foreground">Sem ranking esta semana.</li>}
            </ol>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Kpi({ label, value, loading, accent }: { label: string; value?: number; loading: boolean; accent?: boolean }) {
  return (
    <div className={"rounded-sm border bg-card p-4 " + (accent ? "border-primary/40" : "border-border")}>
      <div className="text-display text-xs text-muted-foreground">{label}</div>
      <div className={"mt-1 text-3xl font-bold " + (accent ? "text-primary" : "")}>
        {loading ? "…" : fmtNum(value)}
      </div>
    </div>
  );
}
