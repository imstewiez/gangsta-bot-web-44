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
} from "lucide-react";

import { ProfileCard } from "@/components/domain/ProfileCard";
import { TierIcon } from "@/components/domain/TierIcon";
import { PageHeader } from "@/components/layout/AppShell";
import { Reveal } from "@/components/layout/Reveal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useAuth } from "@/lib/auth";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { getHomeKpis } from "@/lib/dashboard.functions";
import { fmtNum, TIER_LABELS, TIER_ORDER } from "@/lib/domain";
import { getMyAllTimeStats } from "@/lib/members.functions";
import { getCurrentMember } from "@/lib/pricing.functions";
import { getCurrentMemberXP } from "@/lib/xp.functions";
import { EMPTY_STATE, LOADING } from "@/lib/messages";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type RankRow = {
  display_name?: string | null;
  nick?: string | null;
  score?: number | null;
  deliveries?: number | null;
  sales?: number | null;
  ops?: number | null;
  kills_count?: number | null;
  wins_count?: number | null;
};

type DashboardAny = {
  newMembersWeek?: number;
  totalSaidasWeek?: number;
  totalKillsWeek?: number;
  totalOpsWeek?: number;
  winRate?: number;
  avgKillsPerSaida?: number;
  topOpsParticipants?: { display_name?: string | null; tier?: string | null; ops?: number | null }[];
  lastSaida?: {
    tipo?: string | null;
    spot?: string | null;
    scheduled_at?: string | null;
    was_profitable?: boolean | null;
    our_kills?: number | null;
    survivors?: number | null;
    mvp_name?: string | null;
    mvp_kills?: number | null;
  } | null;
  byTier?: { tier: string; count: number }[];
  topByTier?: { tier: string; name?: string | null; score?: number | null }[];
  topWeek?: RankRow[];
  topWeekLabel?: string | null;
  topPrevWeek?: RankRow[];
  topPrevWeekLabel?: string | null;
  topMonth?: RankRow[];
  topMonthLabel?: string | null;
  prize?: {
    winner_name?: string | null;
    winner_tier?: string | null;
    score?: number | null;
    prize_description?: string | null;
    week_label?: string | null;
    status?: string | null;
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

  const homeFn = useAuthedServerFn(getHomeKpis);
  const xpFn = useAuthedServerFn(getCurrentMemberXP);
  const statsFn = useAuthedServerFn(getMyAllTimeStats);
  const meFn = useAuthedServerFn(getCurrentMember);
  const { profile } = useAuth();

  const home = useQuery({ queryKey: ["home-kpis"], queryFn: () => homeFn() });
  const myXP = useQuery({ queryKey: ["my-xp"], queryFn: () => xpFn(), staleTime: 5_000 });
  const myStats = useQuery({ queryKey: ["my-stats"], queryFn: () => statsFn(), staleTime: 5_000 });
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn(), staleTime: 5_000 });

  const data = home.data as DashboardAny | undefined;
  const isLoading = home.isLoading;
  const h = new Date().getHours();
  const saud = h < 5 ? "Ainda na rua" : h < 12 ? "Bom dia" : h < 19 ? "Boa tarde" : "Boa noite";
  const nome = profile?.display_name?.split(" ")[0] ?? "mano";
  const totalMembers = (data?.byTier ?? []).reduce((sum, row) => sum + Number(row.count || 0), 0);

  return (
    <>
      <PageHeader
        eyebrow="Casa"
        title={`${saud}, ${nome}.`}
        description="Resumo limpo do bairro: atividade, crescimento, prémios e membros em destaque."
        icon={HomeIcon}
      />

      {home.error && (
        <Card className="mb-5 border-destructive/40 bg-destructive/10">
          <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
            <span className="text-destructive">{(home.error as Error).message || "Erro ao carregar dados"}</span>
            <Button onClick={() => home.refetch()} variant="outline" size="sm" className="ml-auto">
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-border/50 bg-card/60 p-4 text-sm text-muted-foreground backdrop-blur-xl">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          {LOADING.dashboard}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <PositiveKpi icon={UserPlus} label="Novas entradas" value={fmtNum(data?.newMembersWeek ?? 0)} sub="Últimos 7 dias" />
        <PositiveKpi icon={Activity} label="Atividade" value={fmtNum(data?.totalOpsWeek ?? 0)} sub={`${fmtNum(data?.totalSaidasWeek ?? 0)} saídas concluídas`} />
        <PositiveKpi icon={Trophy} label="Vitórias" value={`${data?.winRate ?? 0}%`} sub="Taxa semanal registada" />
        <PositiveKpi icon={Crosshair} label="Abates" value={fmtNum(data?.totalKillsWeek ?? 0)} sub={`${data?.avgKillsPerSaida ?? 0} por saída`} />
      </div>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="space-y-5">
          <ProfileCard member={me.data ?? null} xp={myXP.data ?? null} stats={myStats.data ?? null} />
          {data?.prize && <PrizeCard prize={data.prize} />}
        </div>
        <div className="space-y-5">
          <OpsCard data={data} />
          <HierarchyCard rows={data?.byTier ?? []} total={totalMembers} topByTier={data?.topByTier ?? []} />
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <TopCard title="Esta semana" icon={<Flame className="h-4 w-4 text-primary" />} subtitle={data?.topWeekLabel ? formatWeek(data.topWeekLabel) : null} rows={data?.topWeek ?? []} />
        <TopCard title="Semana passada" icon={<CalendarDays className="h-4 w-4 text-info" />} subtitle={data?.topPrevWeekLabel ? formatWeek(data.topPrevWeekLabel) : null} rows={data?.topPrevWeek ?? []} compact />
        <TopCard title="Mês" icon={<Trophy className="h-4 w-4 text-warning" />} subtitle={data?.topMonthLabel ?? null} rows={data?.topMonth ?? []} compact />
      </div>
    </>
  );
}

function PositiveKpi({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub: string }) {
  return (
    <Reveal direction="up">
      <Card className="interactive-card overflow-hidden border-primary/20 bg-card/65 backdrop-blur-xl">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-display text-[10px] tracking-[0.22em] text-muted-foreground">{label}</div>
              <div className="mt-2 text-3xl font-black leading-none font-display text-primary">{value}</div>
              <div className="mt-2 text-xs text-muted-foreground">{sub}</div>
            </div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 ring-1 ring-primary/30">
              <Icon className="h-5 w-5 text-primary" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Reveal>
  );
}

function PrizeCard({ prize }: { prize: NonNullable<DashboardAny["prize"]> }) {
  return (
    <Reveal direction="up">
      <Card className="interactive-card overflow-hidden border-primary/30 bg-gradient-to-br from-primary/12 via-card/85 to-card">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary/15 ring-1 ring-primary/40">
            <Sparkles className="h-7 w-7 text-primary" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-display text-[10px] tracking-[0.26em] text-primary">Prémio semanal</span>
              <Badge className="border-primary/30 bg-primary/10 text-primary">{prize.status === "in_progress" ? "A decorrer" : "Definido"}</Badge>
            </div>
            <div className="text-xl font-black leading-tight font-display">{prize.prize_description || "Prémio por definir"}</div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <TierIcon tier={prize.winner_tier ?? null} size="sm" />
              <span className="font-medium text-foreground">{prize.winner_name ?? "Ainda sem vencedor"}</span>
              {prize.score != null && <span className="font-mono text-xs">· {fmtNum(Math.round(prize.score))} pts</span>}
            </div>
          </div>
          <Button asChild variant="premium" size="sm"><Link to="/premios">Ver prémios</Link></Button>
        </CardContent>
      </Card>
    </Reveal>
  );
}

function OpsCard({ data }: { data?: DashboardAny }) {
  const last = data?.lastSaida;
  const top = data?.topOpsParticipants ?? [];
  return (
    <Card className="interactive-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-display text-sm"><MapPin className="h-4 w-4 text-primary" /> Ritmo da semana</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {last && (
          <div className="rounded-xl border border-border/45 bg-background/30 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{last.spot ?? "Local não definido"}</span>
              {last.was_profitable === true && <Badge className="bg-success/15 text-success">Vitória</Badge>}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{last.tipo ?? "Saída"} · {last.scheduled_at ? new Date(last.scheduled_at).toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Data por definir"}</div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              {Number(last.survivors ?? 0) > 0 && <span className="rounded-full bg-success/10 px-2 py-1 text-success">{last.survivors} sobreviventes</span>}
              {Number(last.our_kills ?? 0) > 0 && <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">{last.our_kills} abates</span>}
              {last.mvp_name && <span className="rounded-full bg-warning/10 px-2 py-1 text-warning">MVP: {last.mvp_name}</span>}
            </div>
          </div>
        )}
        {top.length > 0 ? top.map((p, i) => (
          <div key={`${p.display_name}-${i}`} className="flex items-center gap-3 rounded-xl border border-border/35 bg-white/[0.025] px-3 py-2 interactive-row">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">#{i + 1}</span>
            <TierIcon tier={p.tier ?? null} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.display_name ?? "—"}</span>
            <span className="text-display text-xs text-primary">{p.ops ?? 0} saídas</span>
          </div>
        )) : <p className="text-sm text-muted-foreground">Ainda não há atividade suficiente nesta semana.</p>}
      </CardContent>
    </Card>
  );
}

function HierarchyCard({ rows, total, topByTier }: { rows: { tier: string; count: number }[]; total: number; topByTier: { tier: string; name?: string | null; score?: number | null }[] }) {
  const sorted = [...rows].sort((a, b) => TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier));
  const max = Math.max(1, ...sorted.map((r) => Number(r.count) || 0));
  return (
    <Card className="interactive-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3 text-display text-sm"><span className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Membros ativos</span><Badge className="bg-primary/10 text-primary">{fmtNum(total)}</Badge></CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length ? <ul className="space-y-3">{sorted.map((row) => {
          const count = Number(row.count) || 0;
          const pct = Math.max(4, Math.round((count / max) * 100));
          const names = topByTier.filter((m) => m.tier === row.tier).slice(0, 2);
          return <li key={row.tier} className="rounded-xl border border-border/35 bg-white/[0.025] px-3 py-2.5"><div className="flex items-center justify-between gap-3 text-sm"><span className="flex min-w-0 items-center gap-2"><TierIcon tier={row.tier} size="sm" /><span className="truncate font-medium">{TIER_LABELS[row.tier] ?? row.tier}</span></span><span className="text-display text-xs text-primary">{fmtNum(count)}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/75" style={{ width: `${pct}%` }} /></div>{names.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{names.map((m, i) => <span key={i} className="rounded-full bg-primary/8 px-2 py-0.5 text-[10px] text-muted-foreground">{m.name ?? "—"}</span>)}</div>}</li>;
        })}</ul> : <p className="text-sm text-muted-foreground">{EMPTY_STATE.dashboard.description}</p>}
      </CardContent>
    </Card>
  );
}

function TopCard({ title, icon, subtitle, rows, compact }: { title: string; icon: React.ReactNode; subtitle?: string | null; rows: RankRow[]; compact?: boolean }) {
  return (
    <Card className="interactive-card h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-3 text-display text-sm"><span className="flex items-center gap-2">{icon}{title}</span>{subtitle && <span className="text-[10px] text-muted-foreground">{subtitle}</span>}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length ? <ol className="space-y-2">{rows.slice(0, compact ? 4 : 5).map((row, i) => {
          const name = row.display_name ?? row.nick ?? "Anónimo";
          const bits = [row.deliveries ? `${row.deliveries} entregas` : null, row.sales ? `${row.sales} vendas` : null, row.ops ? `${row.ops} saídas` : null, row.kills_count ? `${row.kills_count} abates` : null, row.wins_count ? `${row.wins_count} vitórias` : null].filter(Boolean).join(" · ");
          return <li key={`${name}-${i}`} className="flex items-center gap-3 rounded-xl border border-border/35 bg-white/[0.025] px-3 py-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">#{i + 1}</span><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{name}</div>{!compact && bits && <div className="truncate text-[11px] text-muted-foreground">{bits}</div>}</div><span className="text-display text-sm text-primary">{fmtNum(Math.round(Number(row.score ?? 0)))}</span></li>;
        })}</ol> : <p className="text-sm text-muted-foreground">{EMPTY_STATE.leaderboard.description}</p>}
      </CardContent>
    </Card>
  );
}

function formatWeek(weekStart: string): string {
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const f = (d: Date) => new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short" }).format(d);
  return `${f(start)} – ${f(end)}`;
}
