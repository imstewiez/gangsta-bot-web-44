import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Clock,
  Flame,
  Ghost,
  Loader2,
  LogIn,
  PackageOpen,
  RotateCcw,
  Search,
  ShoppingBag,
  UserX,
  type LucideIcon,
} from "lucide-react";

import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { getActivityReport, type ActivityMember, type ActivityStatusKey } from "@/lib/activity.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { fmtNum, TIER_LABELS } from "@/lib/domain";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/atividade")({
  head: () => ({ meta: [{ title: "Atividade | Ballas Gang" }] }),
  component: ActivityPage,
});

type FilterKey = "all" | "critical" | "inactive" | "never_portal" | "never_order" | "never_delivery" | "no_activity_7d" | "extreme";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "critical", label: "Críticos" },
  { key: "inactive", label: "Inativos" },
  { key: "never_portal", label: "Nunca portal" },
  { key: "never_order", label: "Nunca encomenda" },
  { key: "never_delivery", label: "Nunca entrega" },
  { key: "no_activity_7d", label: "+7 dias parado" },
  { key: "extreme", label: "Extremos" },
];

function ActivityPage() {
  const reportFn = useAuthedServerFn(getActivityReport);
  const report = useQuery({ queryKey: ["activity-report"], queryFn: () => reportFn(), refetchInterval: 60_000 });
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  const members = report.data?.members ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members
      .filter((m) => matchFilter(m, filter))
      .filter((m) => {
        if (!q) return true;
        return [m.display_name, m.nickname, m.discord_id, m.tier, ...m.flags]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => a.score - b.score || (b.days_since_activity ?? 999) - (a.days_since_activity ?? 999));
  }, [members, filter, search]);

  return (
    <>
      <PageHeader
        eyebrow="Chefia"
        title="Atividade"
        icon={Activity}
        action={
          <Button variant="outline" size="sm" onClick={() => report.refetch()} disabled={report.isFetching}>
            {report.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RotateCcw className="mr-2 h-4 w-4" />}
            Reanalisar
          </Button>
        }
      />

      {report.isLoading && (
        <div className="flex h-72 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {report.error && <Card className="interactive-card p-6 text-sm text-destructive">{report.error instanceof Error ? report.error.message : "Erro ao carregar atividade"}</Card>}

      {report.data && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard icon={UserX} label="Bairristas" value={report.data.summary.total_bairristas} sub="ativos na DB" />
            <MetricCard icon={Ghost} label="Críticos" value={report.data.summary.critical} tone="destructive" sub="sem histórico ou 14+ dias" />
            <MetricCard icon={LogIn} label="Nunca portal" value={report.data.summary.never_portal} tone="warning" sub="nunca entrou no site" />
            <MetricCard icon={ShoppingBag} label="Nunca encomenda" value={report.data.summary.never_order} tone="warning" sub="0 pedidos criados" />
            <MetricCard icon={PackageOpen} label="Nunca entrega" value={report.data.summary.never_delivery} tone="warning" sub="0 entregas aprovadas" />
          </div>

          <Card className="interactive-card">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-display flex items-center gap-2 text-base">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    Radar de inatividade
                  </CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Score 0-100 baseado em portal, encomendas, entregas, regularidade e última atividade. Só Bairristas: Young Blood, O Gunão e Gangster Fodido.
                  </p>
                </div>
                <div className="relative w-full lg:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Procurar nome, nick, Discord ou aviso..." className="pl-9" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-wrap gap-2">
                {FILTERS.map((f) => (
                  <Button key={f.key} size="sm" variant={filter === f.key ? "default" : "outline"} onClick={() => setFilter(f.key)}>
                    {f.label}
                  </Button>
                ))}
              </div>

              <div className="grid gap-3">
                {filtered.length === 0 ? (
                  <div className="rounded-xl border border-border/50 bg-muted/20 p-8 text-center text-sm text-muted-foreground">Sem resultados neste filtro.</div>
                ) : (
                  filtered.map((member) => <ActivityMemberCard key={member.id} member={member} />)
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function matchFilter(member: ActivityMember, filter: FilterKey) {
  switch (filter) {
    case "critical":
      return member.status_key === "critical";
    case "inactive":
      return member.status_key === "inactive" || member.status_key === "critical";
    case "never_portal":
      return !member.portal_created_at;
    case "never_order":
      return member.order_count === 0;
    case "never_delivery":
      return member.delivery_count === 0;
    case "no_activity_7d":
      return member.days_since_activity == null || member.days_since_activity > 7;
    case "extreme":
      return member.status_key === "extreme";
    default:
      return true;
  }
}

function ActivityMemberCard({ member }: { member: ActivityMember }) {
  const status = statusStyle(member.status_key);
  return (
    <div className="rounded-2xl border border-border/50 bg-card/70 p-4 shadow-sm backdrop-blur-xl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/membros/$id" params={{ id: String(member.id) }} className="interactive-link text-base font-semibold text-foreground">
              {member.display_name ?? member.nickname ?? `#${member.id}`}
            </Link>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{TIER_LABELS[member.tier ?? ""] ?? member.tier ?? "—"}</Badge>
            <Badge className={cn("text-[10px] uppercase tracking-wider", status.className)}>{status.label}</Badge>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <MiniStat label="Última atividade" value={member.last_activity_at ? `${daysText(member.days_since_activity)} atrás` : "Nunca"} icon={Clock} />
            <MiniStat label="Portal" value={member.portal_created_at ? (member.portal_last_seen_at ? `${daysText(daysSince(member.portal_last_seen_at))} atrás` : "Entrou") : "Nunca entrou"} icon={LogIn} danger={!member.portal_created_at} />
            <MiniStat label="Encomendas" value={`${fmtNum(member.order_count)} total · ${fmtNum(member.order_count_7d)} em 7d`} icon={ShoppingBag} danger={member.order_count === 0} />
            <MiniStat label="Entregas" value={`${fmtNum(member.delivery_count)} total · ${fmtNum(member.delivery_count_7d)} em 7d`} icon={PackageOpen} danger={member.delivery_count === 0} />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {member.flags.length === 0 ? (
              <span className="rounded-full border border-success/30 bg-success/10 px-2 py-1 text-xs text-success">Sem avisos</span>
            ) : (
              member.flags.slice(0, 6).map((flag) => (
                <span key={flag} className="rounded-full border border-warning/30 bg-warning/10 px-2 py-1 text-xs text-warning">{flag}</span>
              ))
            )}
          </div>
        </div>

        <div className="w-full shrink-0 xl:w-64">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-display text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Activity score</div>
              <div className={cn("mt-1 text-3xl font-black tabular-nums", status.textClass)}>{member.score}</div>
            </div>
            <Flame className={cn("mb-1 h-6 w-6", status.textClass)} />
          </div>
          <Progress value={member.score} className="mt-2 h-2.5" />
          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
            <span>{fmtNum(member.active_days_7)}/7 dias ativos</span>
            <span className="text-right">{fmtNum(member.active_days_30)}/30 dias</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, sub, tone }: { icon: LucideIcon; label: string; value: number; sub: string; tone?: "warning" | "destructive" }) {
  const toneClass = tone === "destructive" ? "text-destructive" : tone === "warning" ? "text-warning" : "text-foreground";
  return (
    <Card className="interactive-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-display text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</span>
          <Icon className={cn("h-4 w-4", toneClass)} />
        </div>
        <div className={cn("mt-2 text-3xl font-black tabular-nums", toneClass)}>{fmtNum(value)}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, icon: Icon, danger }: { label: string; value: string; icon: LucideIcon; danger?: boolean }) {
  return (
    <div className={cn("rounded-xl border bg-muted/20 p-3", danger ? "border-warning/35" : "border-border/40")}>
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className={cn("truncate text-sm font-semibold", danger && "text-warning")}>{value}</div>
    </div>
  );
}

function statusStyle(key: ActivityStatusKey) {
  switch (key) {
    case "extreme":
      return { label: "Extremamente ativo", className: "border-orange-400/40 bg-orange-400/10 text-orange-300", textClass: "text-orange-300" };
    case "active":
      return { label: "Ativo", className: "border-success/40 bg-success/10 text-success", textClass: "text-success" };
    case "irregular":
      return { label: "Irregular", className: "border-warning/40 bg-warning/10 text-warning", textClass: "text-warning" };
    case "inactive":
      return { label: "Inativo", className: "border-destructive/40 bg-destructive/10 text-destructive", textClass: "text-destructive" };
    default:
      return { label: "Crítico", className: "border-destructive/50 bg-destructive/15 text-destructive", textClass: "text-destructive" };
  }
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

function daysText(days: number | null): string {
  if (days == null) return "—";
  if (days === 0) return "hoje";
  if (days === 1) return "1 dia";
  return `${days} dias`;
}
