import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { checkManagerAccess, checkChefiaAccess } from "@/lib/access-check.functions";
import { getChefiaKpis, getOrderCycles, type OrderCycle } from "@/lib/admin.dashboard.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtNum, fmtPrice } from "@/lib/domain";
import { Loader2, TrendingUp, AlertTriangle, Package, Users, DollarSign, Activity, ShoppingCart, Calendar } from "lucide-react";
import { PageErrorBoundary } from "@/components/layout/PageErrorBoundary";
import { Reveal, Stagger } from "@/components/layout/Reveal";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { cn } from "@/lib/utils";
import { EMPTY_STATE, LOADING } from "@/lib/messages";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  errorComponent: PageErrorBoundary,
  head: () => ({
    meta: [{ title: "Painel Chefia | Ballas Gang" }],
  }),
  component: AdminDashboardPage,
});

function AdminDashboardPage() {
  useRealtimeSync([
    { table: "orders", queryKeys: [["chefia-kpis"], ["order-cycles"]] },
    { table: "inventory_balance", queryKeys: [["chefia-kpis"]] },
    { table: "members", queryKeys: [["chefia-kpis"]] },
    { table: "inventory_delivery_requests", queryKeys: [["chefia-kpis"]] },
    { table: "items", queryKeys: [["chefia-kpis"], ["order-cycles"]] },
    { table: "item_tier_surcharges", queryKeys: [["chefia-kpis"], ["order-cycles"]] },
  ]);

  const managerFn = useAuthedServerFn(checkManagerAccess);
  const managerCheck = useQuery({ queryKey: ["managerCheck"], queryFn: () => managerFn() });
  const kpisFn = useAuthedServerFn(getChefiaKpis);
  const kpis = useQuery({ queryKey: ["chefia-kpis"], queryFn: () => kpisFn() });

  const chefiaFn = useAuthedServerFn(checkChefiaAccess);
  const chefiaCheck = useQuery({ queryKey: ["chefiaCheck"], queryFn: () => chefiaFn() });
  const cyclesFn = useAuthedServerFn(getOrderCycles);
  const cycles = useQuery({ queryKey: ["order-cycles"], queryFn: () => cyclesFn(), enabled: chefiaCheck.data?.allowed ?? false });

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

  const k = kpis.data;

  return (
    <>
      <PageHeader eyebrow="Chefia" title="Painel" icon={Activity} />

      <div className="mb-4">
        <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
          ← Voltar
        </Link>
      </div>

      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" staggerDelay={70} baseDelay={100}>
        <KpiCard icon={Users} label="Membros" value={k?.activeMembers ?? 0} sub={`de ${k?.totalMembers ?? 0}`} loading={kpis.isLoading} />
        <KpiCard icon={Package} label="Por confirmar" value={k?.pendingOrders ?? 0} tone="warning" loading={kpis.isLoading} />
        <KpiCard icon={DollarSign} label="7 dias" value={`${fmtPrice(k?.weeklyRevenue ?? 0)}`} tone="success" loading={kpis.isLoading} />
        <KpiCard icon={TrendingUp} label="Stock" value={`${fmtPrice(k?.totalInventoryValue ?? 0)}`} loading={kpis.isLoading} />
      </Stagger>

      {chefiaCheck.data?.allowed && (
        <Reveal direction="up" delay={150}>
          <div className="mt-6">
            <Card className="interactive-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-display flex items-center gap-2 text-sm">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                  Ciclos em gestão
                </CardTitle>
                <p className="text-xs text-muted-foreground">Só encomendas ativas: pendentes, aprovadas, em tratamento ou prontas.</p>
              </CardHeader>
              <CardContent>
                {cycles.isLoading && (
                  <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {LOADING.dashboard}
                  </div>
                )}
                {cycles.data && cycles.data.length === 0 && (
                  <div className="col-span-full py-6 text-center">
                    <ShoppingCart className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-foreground">Sem encomendas ativas</p>
                    <p className="mt-1 text-xs text-muted-foreground">As encomendas entregues ficam no arquivo da página Encomendas.</p>
                  </div>
                )}
                <div className="space-y-4">
                  {cycles.data?.map((cycle) => (
                    <div key={cycle.cycle_start} className="overflow-hidden rounded-lg border border-border/50 bg-muted/20">
                      <div className="flex items-center justify-between bg-muted/40 px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-semibold tracking-wide">
                            {formatDate(cycle.cycle_start)} → {formatDate(cycle.cycle_end)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px]">
                          {cycle.active_count > 0 && (
                            <span className="rounded bg-blue-500/10 px-2 py-0.5 font-medium text-blue-400">
                              {cycle.active_count} em curso
                            </span>
                          )}
                          {cycle.pending_count > 0 && (
                            <span className="rounded bg-amber-500/10 px-2 py-0.5 font-medium text-amber-400">
                              {cycle.pending_count} por confirmar
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-5 divide-x divide-border/30 border-b border-border/30">
                        <CycleKpi label="Encomendas" value={cycle.total_orders} />
                        <CycleKpi label="Material" value={`${fmtNum(cycle.total_material)}u`} />
                        <CycleKpi label="Receita" value={fmtPrice(cycle.total_revenue)} tone="success" />
                        <CycleKpi label="Custo" value={fmtPrice(cycle.total_cost)} tone="warning" />
                        <CycleKpi label="Lucro" value={fmtPrice(cycle.total_profit)} tone={cycle.total_profit >= 0 ? "success" : "destructive"} />
                      </div>

                      {cycle.items.length > 0 && (
                        <div className="px-4 py-3">
                          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Por item</p>
                          <div className="space-y-0">
                            <div className="mb-1 grid grid-cols-[1fr_64px_80px_80px_80px] gap-2 border-b border-border/20 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                              <span>Item</span>
                              <span className="text-right">Qtd</span>
                              <span className="text-right">Receita</span>
                              <span className="text-right">Custo</span>
                              <span className="text-right">Lucro</span>
                            </div>
                            {cycle.items.map((item) => (
                              <div key={item.item_name} className="grid grid-cols-[1fr_64px_80px_80px_80px] items-center gap-2 border-b border-border/10 py-1 text-xs last:border-0">
                                <span className="truncate font-medium">{item.item_name}</span>
                                <span className="text-right tabular-nums text-muted-foreground">{fmtNum(item.quantity)}×</span>
                                <span className="text-right tabular-nums">{fmtPrice(item.revenue)}</span>
                                <span className="text-right tabular-nums text-amber-400">{fmtPrice(item.cost)}</span>
                                <span className={cn("text-right font-medium tabular-nums", item.profit >= 0 ? "text-emerald-400" : "text-destructive")}>{fmtPrice(item.profit)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </Reveal>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Reveal direction="up" delay={300}>
          <Card className="interactive-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-display flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-warning" />
                Inativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {k?.inactiveMembers.length === 0 && (
                <div className="py-6 text-center">
                  <Users className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-foreground">Sem inativos</p>
                  <p className="mt-1 text-xs text-muted-foreground">Últimos 14 dias limpos.</p>
                </div>
              )}
              <div className="space-y-1.5">
                {k?.inactiveMembers.map((m) => (
                  <div key={m.display_name} className="flex items-center justify-between rounded-sm bg-muted/30 px-2 py-1.5 text-sm">
                    <span>{m.display_name ?? "—"}</span>
                    <span className="text-xs text-muted-foreground">{m.days} {m.days === 1 ? "dia" : "dias"}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </>
  );
}

function KpiCard({ icon: Icon, label, value, sub, tone, loading }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  tone?: "success" | "warning" | "destructive";
  loading?: boolean;
}) {
  const color = tone === "success" ? "text-emerald-400" : tone === "warning" ? "text-amber-400" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <Card className="interactive-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-display text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
          <Icon className={cn("h-4 w-4", tone ? color : "text-muted-foreground/60")} />
        </div>
        <div className={cn("mt-1 font-display text-3xl font-bold tabular-nums", color)}>
          {loading ? (
            <div className="flex h-16 flex-col items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{LOADING.dashboard}</p>
            </div>
          ) : value}
        </div>
        {sub && <div className="mt-1 text-[10px] text-muted-foreground/60">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function CycleKpi({ label, value, tone }: {
  label: string;
  value: string | number;
  tone?: "success" | "warning" | "destructive";
}) {
  const color = tone === "success" ? "text-emerald-400" : tone === "warning" ? "text-amber-400" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="px-2 py-2.5 text-center">
      <div className="mb-0.5 text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-xs font-bold tabular-nums", color)}>{value}</div>
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}
