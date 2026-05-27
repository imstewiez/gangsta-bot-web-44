import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { checkManagerAccess, checkChefiaAccess } from "@/lib/access-check.functions";
import { pgQuery, pgOne } from "@/lib/pg.server";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCurrentMember } from "@/lib/pricing.server";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtNum, fmtPrice } from "@/lib/domain";
import { Loader2, TrendingUp, AlertTriangle, Package, Users, DollarSign, Activity, ShoppingCart, Calendar } from "lucide-react";
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

export type OrderCycle = {
  cycle_start: string;
  cycle_end: string;
  total_orders: number;
  total_material: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  fulfilled_count: number;
  pending_count: number;
  items: {
    item_name: string;
    quantity: number;
    revenue: number;
    cost: number;
    profit: number;
  }[];
};

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
        `WITH member_activity AS (
           SELECT
             m.id,
             m.display_name,
             GREATEST(
               COALESCE((SELECT MAX(COALESCE(o.end_time, o.start_time, o.date::timestamp, o.created_at))
                         FROM operations o
                         JOIN operation_participants op ON op.operation_id = o.id
                         WHERE op.member_id = m.id AND o.deleted_at IS NULL), m.joined_at),
               COALESCE((SELECT MAX(r.created_at)
                         FROM inventory_delivery_requests r
                         WHERE r.requester_member_id = m.id), m.joined_at),
               COALESCE((SELECT MAX(ord.created_at)
                         FROM orders ord
                         WHERE ord.member_id = m.id), m.joined_at),
               COALESCE((SELECT MAX(v.created_at)
                         FROM availability_votes v
                         WHERE v.discord_user_id = m.discord_id), m.joined_at),
               m.joined_at,
               m.created_at
             ) as last_active
           FROM members m
           WHERE m.deleted_at IS NULL
             AND COALESCE(m.lifecycle_state::text, 'active') IN ('active', 'promoted')
         )
         SELECT display_name, EXTRACT(day FROM now() - last_active)::int as days
         FROM member_activity
         WHERE last_active < now() - interval '14 days'
         ORDER BY last_active ASC
         LIMIT 10`
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

export const getOrderCycles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OrderCycle[]> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    const isChefia = me?.tier === "kingpin" || me?.tier === "manda_chuva" || me?.role_label === "kingpin" || me?.role_label === "manda_chuva";
    if (!isChefia) throw new Error("Acesso restrito. Apenas Kingpin e Manda-Chuva.");

    const cycles = await pgQuery<{
      cycle_start: string;
      cycle_end: string;
      total_orders: number;
      total_material: number;
      total_revenue: number;
      total_cost: number;
      total_profit: number;
      fulfilled_count: number;
      pending_count: number;
    }>(
      `WITH real_costs AS (
        SELECT
          i.id,
          CASE i.name
            WHEN 'Colete Padrão' THEN 1500
            WHEN 'Mini SMG' THEN 20000
            WHEN 'Pistol XM3' THEN 20000
            WHEN 'Micro SMG' THEN 22000
            WHEN 'TEC-9' THEN 22000
            WHEN 'TEC Pistol' THEN 27000
            WHEN 'AP Pistol' THEN 27000
            WHEN 'Heavy Pistol' THEN 30000
            WHEN '.50 Pistol' THEN 50000
            WHEN 'P90' THEN 60000
            WHEN 'Combat PDW' THEN 60000
            WHEN 'Bullpup Rifle' THEN 85000
            WHEN 'Carabina Especial' THEN 100000
            WHEN 'Compact Rifle' THEN 60000
            WHEN 'Carregador Orange' THEN 330
            WHEN 'Carregador Red' THEN 660
            WHEN 'Carregador Special' THEN 990
            WHEN 'Corpo Mini SMG' THEN 8000
            WHEN 'Corpo Pistol XM3' THEN 8000
            WHEN 'Corpo UZI' THEN 10000
            WHEN 'Corpo TEC-9' THEN 10000
            WHEN 'Corpo TEC Pistol' THEN 15000
            WHEN 'Corpo AP Pistol' THEN 15000
            WHEN 'Print Laranja' THEN 10000
            WHEN 'Print Azul' THEN 50000
            WHEN 'Print Vermelha' THEN 70000
            WHEN 'Print Amarela' THEN 100000
            ELSE COALESCE(i.purchase_price, 0)
          END as unit_cost
        FROM items i
      ),
      cycle_orders AS (
        SELECT
          date_trunc('week', o.created_at)::date as cycle_start,
          (date_trunc('week', o.created_at)::date + interval '6 days')::date as cycle_end,
          o.id,
          o.status,
          o.quantity,
          COALESCE(o.total_price, 0) as total_price,
          COALESCE(rc.unit_cost, 0) as unit_cost
        FROM orders o
        JOIN items i ON i.id = o.item_id
        LEFT JOIN real_costs rc ON rc.id = i.id
        WHERE o.status NOT IN ('cancelled', 'denied')
      )
      SELECT
        cycle_start,
        cycle_end,
        COUNT(DISTINCT id)::int as total_orders,
        SUM(quantity)::int as total_material,
        SUM(total_price)::float as total_revenue,
        SUM(quantity * unit_cost)::float as total_cost,
        SUM(total_price - quantity * unit_cost)::float as total_profit,
        COUNT(*) FILTER (WHERE status = 'fulfilled')::int as fulfilled_count,
        COUNT(*) FILTER (WHERE status IN ('pending', 'approved', 'in_progress', 'ready'))::int as pending_count
      FROM cycle_orders
      GROUP BY cycle_start, cycle_end
      ORDER BY cycle_start DESC
      LIMIT 8`
    ).catch(() => []);

    const items = await pgQuery<{
      cycle_start: string;
      item_name: string;
      quantity: number;
      revenue: number;
      cost: number;
      profit: number;
    }>(
      `WITH real_costs AS (
        SELECT
          i.id,
          CASE i.name
            WHEN 'Colete Padrão' THEN 1500
            WHEN 'Mini SMG' THEN 20000
            WHEN 'Pistol XM3' THEN 20000
            WHEN 'Micro SMG' THEN 22000
            WHEN 'TEC-9' THEN 22000
            WHEN 'TEC Pistol' THEN 27000
            WHEN 'AP Pistol' THEN 27000
            WHEN 'Heavy Pistol' THEN 30000
            WHEN '.50 Pistol' THEN 50000
            WHEN 'P90' THEN 60000
            WHEN 'Combat PDW' THEN 60000
            WHEN 'Bullpup Rifle' THEN 85000
            WHEN 'Carabina Especial' THEN 100000
            WHEN 'Compact Rifle' THEN 60000
            WHEN 'Carregador Orange' THEN 330
            WHEN 'Carregador Red' THEN 660
            WHEN 'Carregador Special' THEN 990
            WHEN 'Corpo Mini SMG' THEN 8000
            WHEN 'Corpo Pistol XM3' THEN 8000
            WHEN 'Corpo UZI' THEN 10000
            WHEN 'Corpo TEC-9' THEN 10000
            WHEN 'Corpo TEC Pistol' THEN 15000
            WHEN 'Corpo AP Pistol' THEN 15000
            WHEN 'Print Laranja' THEN 10000
            WHEN 'Print Azul' THEN 50000
            WHEN 'Print Vermelha' THEN 70000
            WHEN 'Print Amarela' THEN 100000
            ELSE COALESCE(i.purchase_price, 0)
          END as unit_cost
        FROM items i
      )
      SELECT
        date_trunc('week', o.created_at)::date as cycle_start,
        i.name as item_name,
        SUM(o.quantity)::int as quantity,
        SUM(COALESCE(o.total_price, 0))::float as revenue,
        SUM(o.quantity * COALESCE(rc.unit_cost, 0))::float as cost,
        SUM(COALESCE(o.total_price, 0) - o.quantity * COALESCE(rc.unit_cost, 0))::float as profit
      FROM orders o
      JOIN items i ON i.id = o.item_id
      LEFT JOIN real_costs rc ON rc.id = i.id
      WHERE o.status NOT IN ('cancelled', 'denied')
      GROUP BY date_trunc('week', o.created_at)::date, i.name
      ORDER BY cycle_start DESC, profit DESC`
    ).catch(() => []);

    return cycles.map((c) => ({
      ...c,
      items: items.filter((i) => i.cycle_start === c.cycle_start).map((i) => ({
        item_name: i.item_name,
        quantity: i.quantity,
        revenue: i.revenue,
        cost: i.cost,
        profit: i.profit,
      })),
    }));
  });

function AdminDashboardPage() {
  useRealtimeSync([
    { table: "orders", queryKeys: [["chefia-kpis"], ["order-cycles"]] },
    { table: "inventory_balance", queryKeys: [["chefia-kpis"]] },
    { table: "members", queryKeys: [["chefia-kpis"]] },
    { table: "inventory_delivery_requests", queryKeys: [["chefia-kpis"]] },
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

      {/* ── Ciclos de Encomendas (Chefia only) ── */}
      {chefiaCheck.data?.allowed && (
        <Reveal direction="up" delay={150}>
          <div className="mt-6">
            <Card className="interactive-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-display text-sm flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-primary" />
                  Ciclos de Encomendas
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  Ciclo = encomendas de 2ª a domingo, entregues na 2ª seguinte. Custo = ingredientes reais das receitas (corpos com preço interno da chefia).
                </p>
              </CardHeader>
              <CardContent>
                {cycles.isLoading && (
                  <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    A carregar ciclos...
                  </div>
                )}
                {cycles.data && cycles.data.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4">Sem dados de encomendas.</p>
                )}
                <div className="space-y-4">
                  {cycles.data?.map((cycle) => (
                    <div key={cycle.cycle_start} className="rounded-lg border border-border/50 bg-muted/20 overflow-hidden">
                      {/* Header do ciclo */}
                      <div className="flex items-center justify-between bg-muted/40 px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-xs font-semibold tracking-wide">
                            {formatDate(cycle.cycle_start)} → {formatDate(cycle.cycle_end)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px]">
                          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-emerald-400 font-medium">
                            {cycle.fulfilled_count} entregues
                          </span>
                          {cycle.pending_count > 0 && (
                            <span className="rounded bg-amber-500/10 px-2 py-0.5 text-amber-400 font-medium">
                              {cycle.pending_count} pendentes
                            </span>
                          )}
                        </div>
                      </div>

                      {/* KPIs do ciclo — grid 5 colunas */}
                      <div className="grid grid-cols-5 divide-x divide-border/30 border-b border-border/30">
                        <CycleKpi label="Encomendas" value={cycle.total_orders} />
                        <CycleKpi label="Material" value={`${fmtNum(cycle.total_material)}u`} />
                        <CycleKpi label="Receita" value={fmtPrice(cycle.total_revenue)} tone="success" />
                        <CycleKpi label="Custo" value={fmtPrice(cycle.total_cost)} tone="warning" />
                        <CycleKpi label="Lucro" value={fmtPrice(cycle.total_profit)} tone={cycle.total_profit >= 0 ? "success" : "destructive"} />
                      </div>

                      {/* Breakdown por item — tabela */}
                      {cycle.items.length > 0 && (
                        <div className="px-4 py-3">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-medium">Breakdown por item</p>
                          <div className="space-y-0">
                            {/* Header */}
                            <div className="grid grid-cols-[1fr_64px_80px_80px_80px] gap-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/20 pb-1 mb-1">
                              <span>Item</span>
                              <span className="text-right">Qtd</span>
                              <span className="text-right">Receita</span>
                              <span className="text-right">Custo</span>
                              <span className="text-right">Lucro</span>
                            </div>
                            {cycle.items.map((item) => (
                              <div key={item.item_name} className="grid grid-cols-[1fr_64px_80px_80px_80px] gap-2 text-xs py-1 border-b border-border/10 last:border-0 items-center">
                                <span className="truncate font-medium">{item.item_name}</span>
                                <span className="text-right tabular-nums text-muted-foreground">{fmtNum(item.quantity)}×</span>
                                <span className="text-right tabular-nums">{fmtPrice(item.revenue)}</span>
                                <span className="text-right tabular-nums text-amber-400">{fmtPrice(item.cost)}</span>
                                <span className={cn("text-right tabular-nums font-medium", item.profit >= 0 ? "text-emerald-400" : "text-destructive")}>
                                  {fmtPrice(item.profit)}
                                </span>
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

function CycleKpi({ label, value, tone }: {
  label: string;
  value: string | number;
  tone?: "success" | "warning" | "destructive";
}) {
  const color = tone === "success" ? "text-emerald-400" : tone === "warning" ? "text-amber-400" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="px-2 py-2.5 text-center">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">{label}</div>
      <div className={cn("text-xs font-bold tabular-nums", color)}>{value}</div>
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
}
