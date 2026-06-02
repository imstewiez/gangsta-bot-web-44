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
  type LucideIcon,
} from "lucide-react";

import { ProfileCard } from "@/components/domain/ProfileCard";
import { TierIcon } from "@/components/domain/TierIcon";
import { PageHeader } from "@/components/layout/AppShell";
import { Reveal } from "@/components/layout/Reveal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useAuth } from "@/lib/auth";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { getHomeKpis } from "@/lib/dashboard.functions";
import { fmtNum, TIER_LABELS, TIER_ORDER } from "@/lib/domain";
import { getMyAllTimeStats } from "@/lib/members.functions";
import { getCurrentMember } from "@/lib/pricing.functions";
import { getCurrentMemberXP } from "@/lib/xp.functions";
import { EMPTY_STATE, LOADING } from "@/lib/messages";
import { cn } from "@/lib/utils";

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
  const h = new Date().getHours();
  const saud = h < 5 ? "Ainda na rua" : h < 12 ? "Bom dia" : h < 19 ? "Boa tarde" : "Boa noite";
  const nome = profile?.display_name?.split(" ")[0] ?? "mano";
  const totalMembers = (data?.byTier ?? []).reduce((sum, row) => sum + Number(row.count || 0), 0);

  const metrics = [
    { icon: UserPlus, label: "Entradas", value: fmtNum(data?.newMembersWeek ?? 0), sub: "7 dias" },
    { icon: Activity, label: "Atividade", value: fmtNum(data?.totalOpsWeek ?? 0), sub: "registos" },
    { icon: Trophy, label: "Vitórias", value: `${data?.winRate ?? 0}%`, sub: "taxa" },
    { icon: Crosshair, label: "Abates", value: fmtNum(data?.totalKillsWeek ?? 0), sub: `${data?.avgKillsPerSaida ?? 0}/saída` },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Casa"
        title={`${saud}, ${nome}.`}
        description="Um resumo limpo do bairro, com foco no que interessa: evolução, prémios, presença e desempenho."
        icon={HomeIcon}
      />

      {home.error && (
        <Panel className="mb-5 border-destructive/40 bg-destructive/10">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-destructive">{(home.error as Error).message || "Erro ao carregar dados"}</span>
            <Button onClick={() => home.refetch()} variant="outline" size="sm" className="ml-auto">Tentar novamente</Button>
          </div>
        </Panel>
      )}

      {home.isLoading && (
        <Panel className="mb-5 flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          {LOADING.dashboard}
        </Panel>
      )}

      <Reveal direction="up">
        <CommandPanel metrics={metrics} prize={data?.prize ?? null} totalMembers={totalMembers} />
      </Reveal>

      <div className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-7">
          <ProfileCard member={me.data ?? null} xp={myXP.data ?? null} stats={myStats.data ?? null} />
          <LeaderboardPanel data={data} />
        </div>
        <div className="space-y-7 xl:sticky xl:top-6 xl:self-start">
          <OperationPanel data={data} />
          <HierarchyPanel rows={data?.byTier ?? []} total={totalMembers} topByTier={data?.topByTier ?? []} />
        </div>
      </div>
    </>
  );
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-[1.65rem] border border-white/10 bg-card/48 p-5 shadow-[0_24px_90px_-55px_rgba(0,0,0,1)] backdrop-blur-2xl", className)}>
      <div aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/14 to-transparent" />
      <div className="relative">{children}</div>
    </div>
  );
}

function CommandPanel({ metrics, prize, totalMembers }: {
  metrics: { icon: LucideIcon; label: string; value: string; sub: string }[];
  prize: DashboardAny["prize"] | null;
  totalMembers: number;
}) {
  return (
    <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[color-mix(in_oklab,var(--card)_62%,transparent)] p-4 shadow-[0_34px_120px_-66px_rgba(0,0,0,1)] backdrop-blur-2xl md:p-5">
      <div aria-hidden className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-primary/18 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -left-32 bottom-0 h-72 w-72 rounded-full bg-blood/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/55 to-transparent" />

      <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.72fr)]">
        <div className="min-w-0 rounded-[1.45rem] border border-white/[0.07] bg-background/18 p-5 backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-display text-[10px] tracking-[0.32em] text-primary">Ballas Control</div>
              <h2 className="mt-2 text-display text-2xl font-black tracking-tight md:text-3xl">Painel do bairro</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Visão rápida, limpa e sem ruído. Tudo aqui vem dos registos reais da operação.</p>
            </div>
            <Badge className="rounded-full border-primary/25 bg-primary/8 px-3 py-1 text-primary">{fmtNum(totalMembers)} ativos</Badge>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => <MetricPill key={metric.label} {...metric} />)}
          </div>
        </div>

        <WeeklyPrizeLiquid prize={prize} />
      </div>
    </section>
  );
}

function MetricPill({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.028] px-4 py-3 backdrop-blur-xl transition-all duration-200 hover:border-primary/30 hover:bg-primary/[0.045]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-display text-[9px] tracking-[0.22em] text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-primary/90" />
      </div>
      <div className="text-2xl font-black leading-none font-display text-foreground">{value}</div>
      <div className="mt-2 text-[11px] text-muted-foreground/70">{sub}</div>
    </div>
  );
}

function WeeklyPrizeLiquid({ prize }: { prize: DashboardAny["prize"] | null }) {
  const hasPrize = Boolean(prize?.prize_description);
  const label = prize?.status === "in_progress" ? "A decorrer" : hasPrize ? "Definido" : "Por definir";

  return (
    <div className="relative min-h-[235px] overflow-hidden rounded-[1.55rem] border border-primary/30 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_24px_70px_-44px_color-mix(in_oklab,var(--primary)_65%,transparent)]" style={{ background: "radial-gradient(circle at 20% 0%, color-mix(in oklab, white 10%, transparent), transparent 28%), linear-gradient(135deg, color-mix(in oklab, var(--primary) 22%, transparent), color-mix(in oklab, var(--card) 84%, transparent) 48%, color-mix(in oklab, var(--blood) 20%, transparent))" }}>
      <div aria-hidden className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/35 blur-3xl" />
      <div aria-hidden className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-blood/25 blur-3xl" />
      <div aria-hidden className="absolute inset-0 opacity-40" style={{ background: "linear-gradient(115deg, transparent 18%, rgba(255,255,255,0.12) 42%, transparent 66%)", backgroundSize: "220% 100%", animation: "shimmer 4s linear infinite" }} />

      <div className="relative flex h-full flex-col justify-between gap-6">
        <div className="flex items-start justify-between gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15 backdrop-blur-xl">
            <Sparkles className="h-6 w-6 text-white" />
          </span>
          <Badge className="rounded-full border-white/15 bg-white/10 px-3 py-1 text-white">{label}</Badge>
        </div>

        <div>
          <div className="text-display text-[10px] tracking-[0.3em] text-white/65">Prémio da semana</div>
          <div className="mt-2 text-2xl font-black leading-tight font-display text-white md:text-3xl">
            {prize?.prize_description || "Prémio por definir"}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/72">
            <TierIcon tier={prize?.winner_tier ?? null} size="sm" />
            <span>{prize?.winner_name ?? "Ainda sem vencedor"}</span>
            {prize?.score != null && <span className="font-mono text-xs">· {fmtNum(Math.round(Number(prize.score)))} pts</span>}
          </div>
        </div>

        <Button asChild size="sm" variant="outline" className="w-full border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white">
          <Link to="/premios">Ver prémios</Link>
        </Button>
      </div>
    </div>
  );
}

function OperationPanel({ data }: { data?: DashboardAny }) {
  const last = data?.lastSaida;
  const top = data?.topOpsParticipants ?? [];

  return (
    <Panel>
      <SectionTitle icon={MapPin} label="Operação" title="Ritmo da semana" />
      <div className="mt-5 space-y-3">
        {last && (
          <div className="rounded-2xl border border-white/[0.08] bg-background/24 p-4">
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
          <div key={`${p.display_name}-${i}`} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.022] px-3 py-2.5 transition-colors hover:bg-primary/[0.045]">
            <span className="grid h-7 w-7 place-items-center rounded-xl bg-primary/10 text-xs font-bold text-primary">#{i + 1}</span>
            <TierIcon tier={p.tier ?? null} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.display_name ?? "—"}</span>
            <span className="text-display text-xs text-primary">{p.ops ?? 0} saídas</span>
          </div>
        )) : <p className="text-sm text-muted-foreground">Ainda não há atividade suficiente nesta semana.</p>}
      </div>
    </Panel>
  );
}

function HierarchyPanel({ rows, total, topByTier }: { rows: { tier: string; count: number }[]; total: number; topByTier: { tier: string; name?: string | null; score?: number | null }[] }) {
  const sorted = [...rows].sort((a, b) => TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier));
  const max = Math.max(1, ...sorted.map((r) => Number(r.count) || 0));

  return (
    <Panel>
      <SectionTitle icon={Users} label="Hierarquia" title="Membros ativos" value={fmtNum(total)} />
      <div className="mt-5 space-y-3">
        {sorted.length ? sorted.map((row) => {
          const count = Number(row.count) || 0;
          const pct = Math.max(4, Math.round((count / max) * 100));
          const names = topByTier.filter((m) => m.tier === row.tier).slice(0, 2);
          return (
            <div key={row.tier} className="rounded-2xl border border-white/[0.07] bg-white/[0.022] px-3 py-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2"><TierIcon tier={row.tier} size="sm" /><span className="truncate font-medium">{TIER_LABELS[row.tier] ?? row.tier}</span></span>
                <span className="text-display text-xs text-primary">{fmtNum(count)}</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted/65"><div className="h-full rounded-full bg-primary/75" style={{ width: `${pct}%` }} /></div>
              {names.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{names.map((m, i) => <span key={i} className="rounded-full bg-primary/8 px-2 py-0.5 text-[10px] text-muted-foreground">{m.name ?? "—"}</span>)}</div>}
            </div>
          );
        }) : <p className="text-sm text-muted-foreground">{EMPTY_STATE.dashboard.description}</p>}
      </div>
    </Panel>
  );
}

function LeaderboardPanel({ data }: { data?: DashboardAny }) {
  const blocks = [
    { title: "Esta semana", subtitle: data?.topWeekLabel ? formatWeek(data.topWeekLabel) : null, rows: data?.topWeek ?? [] },
    { title: "Semana passada", subtitle: data?.topPrevWeekLabel ? formatWeek(data.topPrevWeekLabel) : null, rows: data?.topPrevWeek ?? [] },
    { title: "Mês", subtitle: data?.topMonthLabel ?? null, rows: data?.topMonth ?? [] },
  ];

  return (
    <Panel>
      <SectionTitle icon={Trophy} label="Destaques" title="Quem está a puxar" />
      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {blocks.map((block) => <LeaderboardBlock key={block.title} {...block} />)}
      </div>
    </Panel>
  );
}

function LeaderboardBlock({ title, subtitle, rows }: { title: string; subtitle?: string | null; rows: RankRow[] }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-background/20 p-3">
      <div className="mb-3">
        <div className="text-display text-[10px] tracking-[0.22em] text-primary">{title}</div>
        {subtitle && <div className="mt-1 text-[11px] text-muted-foreground">{subtitle}</div>}
      </div>
      <ol className="space-y-2">
        {rows.length ? rows.slice(0, 4).map((row, i) => {
          const name = row.display_name ?? row.nick ?? "Anónimo";
          return (
            <li key={`${title}-${name}-${i}`} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-primary/[0.045]">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-primary/10 text-[10px] font-bold text-primary">#{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
              <span className="text-display text-xs text-primary">{fmtNum(Math.round(Number(row.score ?? 0)))}</span>
            </li>
          );
        }) : <li className="py-4 text-sm text-muted-foreground">{EMPTY_STATE.leaderboard.description}</li>}
      </ol>
    </div>
  );
}

function SectionTitle({ icon: Icon, label, title, value }: { icon: LucideIcon; label: string; title: string; value?: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2 text-display text-[10px] tracking-[0.28em] text-primary"><Icon className="h-3.5 w-3.5" />{label}</div>
        <h2 className="mt-1 text-display text-lg font-bold tracking-tight">{title}</h2>
      </div>
      {value && <Badge className="rounded-full bg-primary/10 text-primary">{value}</Badge>}
    </div>
  );
}

function formatWeek(weekStart: string): string {
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const f = (d: Date) => new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short" }).format(d);
  return `${f(start)} – ${f(end)}`;
}
