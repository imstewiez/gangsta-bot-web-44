import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  CalendarDays,
  Crosshair,
  Flame,
  Home as HomeIcon,
  Loader2,
  MapPin,
  Sparkles,
  Trophy,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";

import { ProfileCard } from "@/components/domain/ProfileCard";
import { TierIcon } from "@/components/domain/TierIcon";
import { PageHeader } from "@/components/layout/AppShell";
import { Reveal, Stagger } from "@/components/layout/Reveal";
import { Button } from "@/components/ui/button";
import { LiquidCard, LoadingState, StatCard, StatusBadge } from "@/components/ui/premium";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useAuth } from "@/lib/auth";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { getHomeKpis } from "@/lib/dashboard.functions";
import { fmtNum, TIER_LABELS, TIER_ORDER } from "@/lib/domain";
import { getMyAllTimeStats } from "@/lib/members.functions";
import { getCurrentMember } from "@/lib/pricing.functions";
import { getCurrentMemberXP } from "@/lib/xp.functions";
import { EMPTY_STATE, LOADING } from "@/lib/messages";
import { MEDAL_ICONS } from "@/lib/leaderboard.config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type RankRow = {
  display_name: string | null;
  nick: string | null;
  score: number;
  deliveries: number;
  sales: number;
  ops: number;
  material_points: number;
  sales_points: number;
  ops_points: number;
  kills_count: number;
  wins_count: number;
};

type DashboardData = {
  newMembersWeek: number;
  totalSaidasWeek: number;
  totalKillsWeek: number;
  totalOpsWeek: number;
  winRate: number;
  avgKillsPerSaida: number;
  topOpsParticipants: { display_name: string | null; tier: string | null; ops: number }[];
  lastSaida: {
    tipo: string | null;
    spot: string | null;
    scheduled_at: string | null;
    was_profitable: boolean | null;
    our_kills: number | null;
    survivors: number;
    mvp_name: string | null;
  } | null;
  byTier: { tier: string; count: number }[];
  topByTier: { tier: string; name: string | null; score: number }[];
  topWeek: RankRow[];
  topWeekLabel: string | null;
  topPrevWeek: RankRow[];
  topPrevWeekLabel: string | null;
  topMonth: RankRow[];
  topMonthLabel: string | null;
  prize: {
    winner_name: string | null;
    winner_tier: string | null;
    score: number | null;
    prize_description: string | null;
    week_label: string | null;
    status: "defined" | "in_progress" | "closed" | null;
  } | null;
};

function Dashboard() {
  useRealtimeSync([
    { table: "inventory_movements", queryKeys: [["my-xp"], ["home-kpis"]] },
    { table: "members", queryKeys: [["me"], ["home-kpis"]] },
    { table: "operations", queryKeys: [["home-kpis"]] },
    { table: "weekly_rankings", queryKeys: [["home-kpis"], ["leaderboard"]] },
    { table: "all_time_stats", queryKeys: [["home-kpis"], ["leaderboard"]] },
    { table: "weekly_prizes", queryKeys: [["home-kpis"]] },
    { table: "kill_logs", queryKeys: [["home-kpis"], ["leaderboard"]] },
  ]);

  const fn = useAuthedServerFn(getHomeKpis);
  const xpFn = useAuthedServerFn(getCurrentMemberXP);
  const statsFn = useAuthedServerFn(getMyAllTimeStats);
  const meFn = useAuthedServerFn(getCurrentMember);
  const { profile } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["home-kpis"],
    queryFn: () => fn(),
  });
  const dashboard = data as DashboardData | undefined;
  const myXP = useQuery({ queryKey: ["my-xp"], queryFn: () => xpFn(), staleTime: 5_000 });
  const myStats = useQuery({ queryKey: ["my-stats"], queryFn: () => statsFn(), staleTime: 5_000 });
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn(), staleTime: 5_000 });

  const h = new Date().getHours();
  const saud = h < 5 ? "Ainda na rua" : h < 12 ? "Bom dia" : h < 19 ? "Boa tarde" : "Boa noite";
  const nome = profile?.display_name?.split(" ")[0] ?? "mano";
  const winRateTone = dashboard?.winRate && dashboard.winRate >= 60 ? "success" : dashboard?.winRate && dashboard.winRate >= 40 ? "warning" : "primary";
  const totalActiveMembers = (dashboard?.byTier ?? []).reduce((sum, t) => sum + Number(t.count || 0), 0);

  return (
    <>
      <PageHeader eyebrow="Casa" title={`${saud}, ${nome}.`} description="Visão rápida do que está a correr bem no bairro. Dados reais, limpos e sem ruído." icon={HomeIcon} />

      {error && (
        <LiquidCard className="mb-5 border-destructive/40 bg-destructive/10 p-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-destructive">{(error as Error).message || "Erro ao carregar dados"}</span>
            <Button onClick={() => refetch()} variant="glass" size="sm" className="ml-auto">Tentar novamente</Button>
          </div>
        </LiquidCard>
      )}

      {isLoading && <LoadingState className="mb-5" title="A preparar a Casa" description={LOADING.dashboard} />}

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" staggerDelay={70} baseDelay={80}>
        <StatCard icon={UserPlus} label="Novas entradas" value={fmtNum(dashboard?.newMembersWeek ?? 0)} loading={isLoading} tone="primary" subtext="Últimos 7 dias" />
        <StatCard icon={Activity} label="Atividade" value={fmtNum(dashboard?.totalOpsWeek ?? 0)} loading={isLoading} tone="info" subtext={`${fmtNum(dashboard?.totalSaidasWeek ?? 0)} saída${(dashboard?.totalSaidasWeek ?? 0) === 1 ? "" : "s"} concluída${(dashboard?.totalSaidasWeek ?? 0) === 1 ? "" : "s"}`} />
        <StatCard icon={Trophy} label="Taxa de vitórias" value={`${dashboard?.winRate ?? 0}%`} loading={isLoading} tone={winRateTone} subtext="Combates registados esta semana" />
        <StatCard icon={Crosshair} label="Abates registados" value={fmtNum(dashboard?.totalKillsWeek ?? 0)} loading={isLoading} tone="success" subtext={`${dashboard?.avgKillsPerSaida ?? 0} por saída em média`} />
      </Stagger>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
        <div className="space-y-5">
          <ProfileCard member={me.data ?? null} xp={myXP.data ?? null} stats={myStats.data ?? null} />
          {dashboard?.prize && <Reveal delay={120} direction="up"><PrizeSpotlight prize={dashboard.prize} /></Reveal>}
        </div>

        <div className="space-y-5">
          <Reveal delay={120} direction="up"><PositiveOpsCard data={dashboard} loading={isLoading} /></Reveal>
          <Reveal delay={180} direction="up"><HierarchyCard rows={dashboard?.byTier ?? []} total={totalActiveMembers} topByTier={dashboard?.topByTier ?? []} loading={isLoading} /></Reveal>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Reveal delay={100} direction="up"><TopList icon={<Flame className="h-3.5 w-3.5 text-primary" />} title="Esta semana" subtitle={dashboard?.topWeekLabel ? formatWeek(dashboard.topWeekLabel) : null} rows={dashboard?.topWeek} loading={isLoading} /></Reveal>
        <Reveal delay={160} direction="up"><TopList icon={<CalendarDays className="h-3.5 w-3.5 text-info" />} title="Semana passada" subtitle={dashboard?.topPrevWeekLabel ? formatWeek(dashboard.topPrevWeekLabel) : null} rows={dashboard?.topPrevWeek} loading={isLoading} compact /></Reveal>
        <Reveal delay={220} direction="up"><TopList icon={<Trophy className="h-3.5 w-3.5 text-warning" />} title="Mês" subtitle={dashboard?.topMonthLabel ?? null} rows={dashboard?.topMonth} loading={isLoading} compact /></Reveal>
      </div>
    </>
  );
}

function PositiveOpsCard({ data, loading }: { data: DashboardData | undefined; loading: boolean }) {
  const last = data?.lastSaida;
  const top = data?.topOpsParticipants ?? [];

  return (
    <LiquidCard interactive className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div><div className="text-display text-[10px] tracking-[0.28em] text-primary">Operação</div><h2 className="mt-1 text-display text-xl font-bold">Ritmo da semana</h2><p className="mt-1 text-sm text-muted-foreground">Atividade útil e presença nas saídas, sem ruído negativo.</p></div>
        <StatusBadge tone="primary" icon={Zap}>Live</StatusBadge>
      </div>
      {loading ? <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> A carregar atividade…</div> : (
        <div className="mt-5 space-y-4">
          {last && <div className="rounded-2xl border border-border/45 bg-background/32 p-4"><div className="flex items-center gap-2 text-display text-[11px] tracking-[0.22em] text-muted-foreground"><MapPin className="h-3.5 w-3.5 text-primary" /> Última saída registada</div><div className="mt-2 flex flex-wrap items-center gap-2"><span className="text-lg font-semibold">{last.spot ?? "Local não definido"}</span>{last.was_profitable === true && <StatusBadge tone="success" icon={Trophy}>Vitória</StatusBadge>}</div><div className="mt-1 text-xs text-muted-foreground">{last.tipo ?? "Saída"} · {last.scheduled_at ? new Date(last.scheduled_at).toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Data por definir"}</div><div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">{last.survivors > 0 && <span className="rounded-full bg-success/10 px-2 py-1 text-success">{last.survivors} sobrevivente{last.survivors === 1 ? "" : "s"}</span>}{last.our_kills != null && last.our_kills > 0 && <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">{last.our_kills} abate{last.our_kills === 1 ? "" : "s"}</span>}{last.mvp_name && <span className="rounded-full bg-warning/10 px-2 py-1 text-warning">MVP: {last.mvp_name}</span>}</div></div>}
          {top.length > 0 ? <div className="space-y-2"><div className="text-display text-[10px] tracking-[0.24em] text-muted-foreground">Mais presentes em saídas</div>{top.map((p, i) => <div key={`${p.display_name}-${i}`} className="flex items-center gap-3 rounded-xl border border-border/35 bg-white/[0.025] px-3 py-2 interactive-row"><span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">#{i + 1}</span><TierIcon tier={p.tier} size="sm" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{p.display_name ?? "—"}</span><span className="text-display text-xs tabular-nums text-primary">{p.ops} saída{p.ops === 1 ? "" : "s"}</span></div>)}</div> : <p className="text-sm text-muted-foreground">Ainda não há atividade suficiente nesta semana.</p>}
          <Button asChild variant="glass" size="sm" className="w-full"><Link to="/operacoes">Ver saídas</Link></Button>
        </div>
      )}
    </LiquidCard>
  );
}

function PrizeSpotlight({ prize }: { prize: NonNullable<DashboardData["prize"]> }) {
  const inProgress = prize.status === "in_progress";
  return <LiquidCard glow interactive className="overflow-hidden p-5"><div aria-hidden className="absolute inset-0 bg-[linear-gradient(115deg,transparent_20%,color-mix(in_oklab,var(--primary)_12%,transparent)_45%,transparent_70%)] bg-[length:220%_100%] animate-shimmer" /><div className="relative flex flex-col gap-4 sm:flex-row sm:items-center"><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/12 ring-1 ring-inset ring-primary/35">{inProgress ? <Flame className="h-7 w-7 text-primary" /> : <Sparkles className="h-7 w-7 text-primary" />}</span><div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap items-center gap-2"><span className="text-display text-[10px] tracking-[0.26em] text-primary">Prémio semanal</span><StatusBadge tone={inProgress ? "warning" : "primary"}>{inProgress ? "A decorrer" : "Definido"}</StatusBadge></div><div className="text-xl font-black leading-tight font-display text-foreground">{prize.prize_description || "Prémio por definir"}</div><div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><TierIcon tier={prize.winner_tier} size="sm" /><span className="font-medium text-foreground">{prize.winner_name ?? "Ainda sem vencedor"}</span>{prize.score != null && <span className="font-mono text-xs">· {fmtNum(Math.round(prize.score))} pts</span>}{prize.week_label && <span className="text-xs">· Semana {prize.week_label}</span>}</div></div><Button asChild variant="premium" size="sm" className="shrink-0"><Link to="/premios">Ver prémios</Link></Button></div></LiquidCard>;
}

function HierarchyCard({ rows, total, topByTier, loading }: { rows: { tier: string; count: number }[]; total: number; topByTier: { tier: string; name: string | null; score: number }[]; loading: boolean }) {
  const sorted = [...rows].sort((a, b) => TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier));
  const max = Math.max(1, ...sorted.map((r) => Number(r.count) || 0));
  return <LiquidCard interactive className="p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-display text-[10px] tracking-[0.28em] text-primary">Hierarquia</div><h2 className="mt-1 text-display text-xl font-bold">Membros ativos</h2></div><StatusBadge tone="primary" icon={Users}>{fmtNum(total)}</StatusBadge></div>{loading ? <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> A carregar hierarquia…</div> : sorted.length ? <ul className="mt-5 space-y-3">{sorted.map((t) => { const n = Number(t.count) || 0; const pct = Math.max(4, Math.round((n / max) * 100)); const topMembers = topByTier.filter((m) => m.tier === t.tier).slice(0, 2); return <li key={t.tier} className="rounded-xl border border-border/35 bg-white/[0.025] px-3 py-2.5"><div className="flex items-center justify-between gap-3 text-sm"><span className="flex min-w-0 items-center gap-2"><TierIcon tier={t.tier} size="sm" /><span className="truncate font-medium">{TIER_LABELS[t.tier] ?? t.tier}</span></span><span className="text-display text-xs tabular-nums text-primary">{fmtNum(n)}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/70"><div className="h-full rounded-full bg-primary/75 transition-all duration-700" style={{ width: `${pct}%` }} /></div>{topMembers.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{topMembers.map((m, i) => <span key={i} className="rounded-full bg-primary/8 px-2 py-0.5 text-[10px] text-muted-foreground">{m.name ?? "—"} · {fmtNum(Math.round(m.score))} pts</span>)}</div>}</li>; })}</ul> : <div className="mt-5 text-sm text-muted-foreground">{EMPTY_STATE.dashboard.description}</div>}</LiquidCard>;
}

function TopList({ title, icon, subtitle, rows, loading, compact }: { title: string; icon?: React.ReactNode; subtitle?: string | null; rows?: RankRow[]; loading?: boolean; compact?: boolean }) {
  return <LiquidCard interactive className="h-full p-5"><div className="mb-4 flex items-start justify-between gap-3"><div><div className="inline-flex items-center gap-1.5 text-display text-[10px] tracking-[0.24em] text-primary">{icon}{title}</div>{subtitle && <div className="mt-1 text-xs text-muted-foreground">{subtitle}</div>}</div><StatusBadge tone="default">Top</StatusBadge></div>{loading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> A carregar…</div> : rows?.length ? <ol className="space-y-2">{rows.slice(0, compact ? 4 : 5).map((m, i) => { const name = m.display_name ?? m.nick ?? "Anónimo"; const bits: string[] = []; if (m.deliveries) bits.push(`${m.deliveries} entrega${m.deliveries > 1 ? "s" : ""}`); if (m.sales) bits.push(`${m.sales} venda${m.sales > 1 ? "s" : ""}`); if (m.ops) bits.push(`${m.ops} saída${m.ops > 1 ? "s" : ""}`); if (m.kills_count) bits.push(`${m.kills_count} abate${m.kills_count > 1 ? "s" : ""}`); if (m.wins_count) bits.push(`${m.wins_count} vitória${m.wins_count > 1 ? "s" : ""}`); const medal = MEDAL_ICONS[i]; return <li key={i} className={cn("flex items-center gap-3 rounded-xl border border-border/35 bg-white/[0.025] px-3", compact ? "py-2" : "py-2.5", i === 0 && "border-primary/35 bg-primary/8")}><span className="grid h-7 w-7 place-items-center rounded-lg bg-background/55">{medal ? <medal.Cmp className={cn("h-4 w-4", medal.cls)} /> : <span className="text-xs text-muted-foreground">#{i + 1}</span>}</span><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{name}</div>{!compact && bits.length > 0 && <div className="truncate text-[11px] text-muted-foreground">{bits.join(" · ")}</div>}</div><span className="text-display text-sm tabular-nums text-primary">{fmtNum(Math.round(m.score))}</span></li>; })}</ol> : <div className="rounded-xl border border-border/35 bg-muted/20 px-4 py-6 text-center"><Trophy className="mx-auto mb-2 h-7 w-7 text-muted-foreground/35" /><p className="text-sm font-medium text-foreground">{EMPTY_STATE.leaderboard.title}</p><p className="mt-1 text-xs text-muted-foreground">{EMPTY_STATE.leaderboard.description}</p></div>}</LiquidCard>;
}

function formatWeek(weekStart: string): string {
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const f = (d: Date) => new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short" }).format(d);
  return `${f(start)} – ${f(end)}`;
}
