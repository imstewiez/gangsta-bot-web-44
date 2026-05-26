import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { checkManagerAccess } from "@/lib/access-check.functions";
import { pgQuery, pgOne } from "@/lib/pg.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCurrentMember } from "@/lib/pricing.server";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtNum, fmtPrice } from "@/lib/domain";
import { Loader2, TrendingUp, AlertTriangle, Package, Users, DollarSign, Activity } from "lucide-react";
import { PageErrorBoundary } from "@/components/layout/PageErrorBoundary";
import { Reveal, Stagger } from "@/components/layout/Reveal";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/dashboard")({
  errorComponent: PageErrorBoundary,
  head: () => ({
    meta: [{ title: "Dashboard Chefia | Ballas Gang" }],
  }),
  component: AdminDashboardPage,
});

export const getChefiaKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Acesso restrito à direção.");

    const [
      totalMembers,
      activeMembers,
      pendingOrders,
      pendingDeliveries,
      lowStock,
      totalInventoryValue,
      weeklyRevenue,
      inactiveMembers,
    ] = await Promise.all([
      pgOne<{ count: number }>(`select count(*)::int as count from members where deleted_at is null`).catch(() => ({ count: 0 })),
      pgOne<{ count: number }>(`select count(*)::int as count from members where deleted_at is null and coalesce(lifecycle_state::text, 'active') in ('active', 'promoted')`).catch(() => ({ count: 0 })),
      pgOne<{ count: number }>(`select count(*)::int as count from orders where status in ('pending', 'approved', 'in_progress', 'ready')`).catch(() => ({ count: 0 })),
      pgOne<{ count: number }>(`select count(*)::int as count from inventory_delivery_requests where status = 'pending'`).catch(() => ({ count: 0 })),
      pgQuery<{ name: string; balance: number }>(
        `select i.name, coalesce(b.balance, 0)::int as balance
         from items i
         left join inventory_balance b on b.item_id = i.id
         where i.active = true and i.side = 'venda'
           and coalesce(b.balance, 0) < 5
         order by coalesce(b.balance, 0) asc
         limit 10`
      ).catch(() => []),
      pgOne<{ total: number }>(
        `select coalesce(sum(coalesce(b.balance, 0) * coalesce(i.min_sale_price, 0)), 0)::float as total
         from items i
         left join inventory_balance b on b.item_id = i.id
         where i.active = true`
      ).catch(() => ({ total: 0 })),
      pgOne<{ total: number }>(
        `select coalesce(sum(total_price), 0)::float as total
         from orders
         where status = 'fulfilled'
           and created_at >= now() - interval '7 days'`
      ).catch(() => ({ total: 0 })),
      pgQuery<{ display_name: string | null; days: number }>(
        `select display_name, extract(day from now() - coalesce(updated_at, joined_at, created_at))::int as days
         from members
         where deleted_at is null
           and coalesce(lifecycle_state::text, 'active') in ('active', 'promoted')
           and coalesce(updated_at, joined_at, created_at) < now() - interval '14 days'
         order by coalesce(updated_at, joined_at, created_at) asc
         limit 10`
      ).catch(() => []),
    ]);

    return {
      totalMembers: totalMembers?.count ?? 0,
      activeMembers: activeMembers?.count ?? 0,
      pendingOrders: pendingOrders?.count ?? 0,
      pendingDeliveries: pendingDeliveries?.count ?? 0,
      lowStock,
      totalInventoryValue: totalInventoryValue?.total ?? 0,
      weeklyRevenue: weeklyRevenue?.total ?? 0,
      inactiveMembers,
    };
  });

function AdminDashboardPage() {
  useRealtimeSync([
    { table: "orders", queryKeys: [["chefia-kpis"]] },
    { table: "inventory_balance", queryKeys: [["chefia-kpis"]] },
    { table: "members", queryKeys: [["chefia-kpis"]] },
    { table: "inventory_delivery_requests", queryKeys: [["chefia-kpis"]] },
  ]);

  const managerFn = useAuthedServerFn(checkManagerAccess);
  const managerCheck = useQuery({ queryKey: ["managerCheck"], queryFn: () => managerFn() });
  const kpisFn = useAuthedServerFn(getChefiaKpis);
  const kpis = useQuery({ queryKey: ["chefia-kpis"], queryFn: () => kpisFn() });

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
      <PageHeader
        eyebrow="Chefia"
        title="Dashboard"
        description="Visão geral da firma"
        icon={Activity}
      />

      <div className="mb-4">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Voltar às definições
        </Link>
      </div>

      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" staggerDelay={70} baseDelay={100}>
        <KpiCard icon={Users} label="Membros ativos" value={k?.activeMembers ?? 0} sub={`de ${k?.totalMembers ?? 0} total`} />
        <KpiCard icon={Package} label="Encomendas pendentes" value={k?.pendingOrders ?? 0} tone="warning" />
        <KpiCard icon={DollarSign} label="Faturação (7d)" value={`${fmtPrice(k?.weeklyRevenue ?? 0)}`} tone="success" />
        <KpiCard icon={TrendingUp} label="Valor stock" value={`${fmtPrice(k?.totalInventoryValue ?? 0)}`} />
      </Stagger>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Reveal direction="up" delay={200}>
          <Card className="interactive-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-display text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Stock crítico
              </CardTitle>
            </CardHeader>
            <CardContent>
              {k?.lowStock.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhum item em stock crítico.</p>
              )}
              <div className="space-y-1.5">
                {k?.lowStock.map((item) => (
                  <div key={item.name} className="flex items-center justify-between rounded-sm bg-destructive/5 px-2 py-1.5 text-sm">
                    <span>{item.name}</span>
                    <span className="font-mono text-xs text-destructive">{item.balance} em casa</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal direction="up" delay={300}>
          <Card className="interactive-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-display text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-warning" />
                Membros inativos (+14 dias)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {k?.inactiveMembers.length === 0 && (
                <p className="text-sm text-muted-foreground">Todos os membros estão activos.</p>
              )}
              <div className="space-y-1.5">
                {k?.inactiveMembers.map((m) => (
                  <div key={m.display_name} className="flex items-center justify-between rounded-sm bg-muted/30 px-2 py-1.5 text-sm">
                    <span>{m.display_name ?? "—"}</span>
                    <span className="text-xs text-muted-foreground">{m.days} dias</span>
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

function KpiCard({ icon: Icon, label, value, sub, tone }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  sub?: string;
  tone?: "success" | "warning" | "destructive";
}) {
  const color = tone === "success" ? "text-emerald-400" : tone === "warning" ? "text-amber-400" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <Card className="interactive-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-display text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{label}</span>
          <Icon className={cn("h-4 w-4", tone ? color : "text-muted-foreground/60")} />
        </div>
        <div className={cn("mt-1 text-3xl font-bold tabular-nums font-display", color)}>
          {value}
        </div>
        {sub && <div className="mt-1 text-[10px] text-muted-foreground/60">{sub}</div>}
      </CardContent>
    </Card>
  );
}
