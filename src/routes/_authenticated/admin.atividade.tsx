import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock,
  Loader2,
  LogIn,
  MessageSquare,
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

type FilterKey = "all" | "critical" | "some" | "ok" | "never_portal" | "never_order" | "never_delivery" | "no_discord_7d" | "no_activity_7d";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "critical", label: "Sem atividade" },
  { key: "some", label: "Alguma atividade" },
  { key: "ok", label: "Ativos / OK" },
  { key: "no_activity_7d", label: "+7 dias parado" },
  { key: "never_portal", label: "Nunca portal" },
  { key: "never_order", label: "Nunca encomenda" },
  { key: "never_delivery", label: "Nunca entrega" },
  { key: "no_discord_7d", label: "Sem Discord 7d" },
];

function ActivityPage() {
  const reportFn = useAuthedServerFn(getActivityReport);
  const report = useQuery({ queryKey: ["activity-report"], queryFn: () => reportFn(), refetchInterval: 60_000 });
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  const members = report.data?.members ?? [];
  const simple = useMemo(() => {
    const ok = members.filter((m) => m.status_key === "active" || m.status_key === "extreme").length;
    const some = members.filter((m) => m.status_key === "irregular" || m.status_key === "inactive").length;
    return { ok, some };
  }, [members]);

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
      .sort((a, b) => {
        const statusOrder = statusRank(a.status_key) - statusRank(b.status_key);
        if (statusOrder !== 0) return statusOrder;
        return a.score - b.score || (b.days_since_activity ?? 999) - (a.days_since_activity ?? 999);
      });
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
          <div className="grid gap-3 md:grid-cols-4">
            <SummaryCard icon={UserX} label="Bairristas" value={report.data.summary.total_bairristas} sub="ativos na DB" />
            <SummaryCard icon={Clock} label="Sem atividade" value={report.data.summary.critical} tone="destructive" sub="nada registado" />
            <SummaryCard icon={Activity} label="Alguma atividade" value={simple.some} tone="warning" sub="tem sinais, mas pouco" />
            <SummaryCard icon={CheckCircle2} label="Ativos / OK" value={simple.ok} tone="success" sub="presença clara" />
          </div>

          <Card className="interactive-card">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-display flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4 text-primary" />
                    Leitura simples
                  </CardTitle>
                  <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
                    O objetivo é separar quem não faz nada, quem tem sinais de presença e quem está claramente ativo. Discord ajuda no contexto, mas não condena sozinho porque o tracking começou agora.
                  </p>
                </div>
                <div className="relative w-full lg:w-80">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Procurar membro ou aviso..." className="pl-9" />
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

              <div className="overflow-hidden rounded-2xl border border-border/50">
                <div className="grid grid-cols-[minmax(220px,1.3fr)_120px_minmax(260px,1.6fr)_140px] gap-3 border-b border-border/50 bg-muted/15 px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground max-xl:hidden">
                  <span>Membro</span>
                  <span>Estado</span>
                  <span>Atividade</span>
                  <span className="text-right">Score</span>
                </div>
                {filtered.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">Sem resultados neste filtro.</div>
                ) : (
                  filtered.map((member) => <ActivityRow key={member.id} member={member} />)
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
    case "some":
      return member.status_key === "irregular" || member.status_key === "inactive";
    case "ok":
      return member.status_key === "active" || member.status_key === "extreme";
    case "never_portal":
      return !member.portal_created_at;
    case "never_order":
      return member.order_count === 0;
    case "never_delivery":
      return member.delivery_count === 0;
    case "no_discord_7d":
      return !member.last_discord_message_at || daysSince(member.last_discord_message_at) > 7;
    case "no_activity_7d":
      return member.days_since_activity == null || member.days_since_activity > 7;
    default:
      return true;
  }
}

function ActivityRow({ member }: { member: ActivityMember }) {
  const status = statusStyle(member.status_key);
  const mainSignals = buildSignalText(member);
  const flags = member.flags.slice(0, 3);

  return (
    <div className="grid grid-cols-1 gap-3 border-b border-border/40 px-4 py-4 last:border-b-0 xl:grid-cols-[minmax(220px,1.3fr)_120px_minmax(260px,1.6fr)_140px] xl:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/membros/$id" params={{ id: String(member.id) }} className="interactive-link truncate text-base font-semibold text-foreground">
            {member.display_name ?? member.nickname ?? `#${member.id}`}
          </Link>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{TIER_LABELS[member.tier ?? ""] ?? member.tier ?? "—"}</Badge>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">Última atividade: {member.last_activity_at ? `${daysText(member.days_since_activity)} atrás` : "nunca"}</div>
      </div>

      <div>
        <Badge className={cn("border text-[11px] uppercase tracking-wider", status.className)}>{status.label}</Badge>
      </div>

      <div className="space-y-2">
        <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-4 xl:grid-cols-4">
          <Signal icon={MessageSquare} label="Discord" value={`${fmtNum(member.discord_message_count_7d)} msgs`} />
          <Signal icon={LogIn} label="Portal" value={member.portal_created_at ? "entrou" : "nunca"} muted={!member.portal_created_at} />
          <Signal icon={ShoppingBag} label="Encomendas" value={`${fmtNum(member.order_count)}`} muted={member.order_count === 0} />
          <Signal icon={PackageOpen} label="Entregas" value={`${fmtNum(member.delivery_count)}`} muted={member.delivery_count === 0} />
        </div>
        <div className="text-xs text-muted-foreground">{mainSignals}</div>
        {flags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {flags.map((flag) => <span key={flag} className="rounded-full border border-border/60 bg-muted/20 px-2 py-0.5 text-[11px] text-muted-foreground">{flag}</span>)}
          </div>
        )}
      </div>

      <div className="xl:text-right">
        <div className={cn("text-2xl font-black tabular-nums", status.textClass)}>{member.score}</div>
        <Progress value={member.score} className="mt-1 h-2 xl:ml-auto xl:w-28" />
        <div className="mt-1 text-[11px] text-muted-foreground">{fmtNum(member.active_days_7)}/7 dias</div>
      </div>
    </div>
  );
}

function buildSignalText(member: ActivityMember) {
  if (member.status_key === "critical") return "Sem sinais reais: portal, Discord, encomendas e entregas a zero.";
  const bits: string[] = [];
  if (member.discord_message_count_7d > 0) bits.push(`${fmtNum(member.discord_message_count_7d)} mensagens em 7d`);
  if (member.order_count_7d > 0) bits.push(`${fmtNum(member.order_count_7d)} encomendas em 7d`);
  if (member.delivery_count_7d > 0) bits.push(`${fmtNum(member.delivery_count_7d)} entregas em 7d`);
  if (bits.length === 0 && member.days_since_activity != null) bits.push(`último sinal há ${member.days_since_activity} dias`);
  if (bits.length === 0) bits.push("tem histórico, mas sem movimento recente claro");
  return bits.join(" · ");
}

function SummaryCard({ icon: Icon, label, value, sub, tone }: { icon: LucideIcon; label: string; value: number; sub: string; tone?: "success" | "warning" | "destructive" }) {
  const toneClass = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "destructive" ? "text-destructive" : "text-foreground";
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

function Signal({ icon: Icon, label, value, muted }: { icon: LucideIcon; label: string; value: string; muted?: boolean }) {
  return (
    <div className={cn("rounded-xl border border-border/45 bg-muted/15 px-3 py-2", muted && "opacity-60")}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em]"><Icon className="h-3.5 w-3.5" />{label}</div>
      <div className="mt-0.5 font-semibold text-foreground">{value}</div>
    </div>
  );
}

function statusRank(key: ActivityStatusKey) {
  switch (key) {
    case "critical": return 0;
    case "inactive": return 1;
    case "irregular": return 2;
    case "active": return 3;
    case "extreme": return 4;
    default: return 5;
  }
}

function statusStyle(key: ActivityStatusKey) {
  switch (key) {
    case "extreme":
      return { label: "Muito ativo", className: "border-success/40 bg-success/10 text-success", textClass: "text-success" };
    case "active":
      return { label: "Ativo / OK", className: "border-success/40 bg-success/10 text-success", textClass: "text-success" };
    case "irregular":
      return { label: "Alguma atividade", className: "border-warning/40 bg-warning/10 text-warning", textClass: "text-warning" };
    case "inactive":
      return { label: "Parado", className: "border-warning/40 bg-warning/10 text-warning", textClass: "text-warning" };
    default:
      return { label: "Sem atividade", className: "border-destructive/50 bg-destructive/15 text-destructive", textClass: "text-destructive" };
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
