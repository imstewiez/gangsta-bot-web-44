import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { getHomeKpis } from "@/lib/dashboard.functions";
import { getCurrentMemberXP } from "@/lib/xp.functions";
import { getMyAllTimeStats } from "@/lib/members.functions";
import { getCurrentMember } from "@/lib/pricing.functions";
import { ProfileCard } from "@/components/domain/ProfileCard";
import { PageHeader } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { fmtNum, TIER_LABELS, TIER_ORDER } from "@/lib/domain";
import { TierIcon } from "@/components/domain/TierIcon";
import {
  Flame, CalendarDays, Trophy, Medal, Award,
  UserPlus, Skull, Crosshair, Home as HomeIcon,
  Sparkles, Users, Swords, Zap, MapPin,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Reveal, Stagger } from "@/components/layout/Reveal";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

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
  const myXP = useQuery({
    queryKey: ["my-xp"],
    queryFn: () => xpFn(),
    staleTime: 5_000,
  });
  const myStats = useQuery({
    queryKey: ["my-stats"],
    queryFn: () => statsFn(),
    staleTime: 5_000,
  });
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => meFn(),
    staleTime: 5_000,
  });

  const h = new Date().getHours();
  const saud =
    h < 5 ? "Ainda na rua" : h < 12 ? "Bom dia" : h < 19 ? "Boa tarde" : "Boa noite";
  const nome = profile?.display_name?.split(" ")[0] ?? "mano";

  return (
    <>
      <PageHeader
        eyebrow="Casa"
        title={`${saud}, ${nome}.`}
        description="Resumo da firma"
        icon={HomeIcon}
      />

      {error && (
        <div className="mb-4 flex items-center gap-3 rounded-sm border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm animate-rise">
          <span className="text-destructive">{(error as Error).message || "Erro ao carregar dados"}</span>
          <button
            onClick={() => refetch()}
            className="ml-auto cursor-pointer text-display text-[10px] tracking-wider text-destructive underline underline-offset-2 hover:text-destructive/80"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" staggerDelay={70} baseDelay={100}>
        <Kpi icon={UserPlus} label="Entradas (7d)" value={data?.newMembersWeek} loading={isLoading} accent />
        <Kpi icon={Crosshair} label="Saídas (7d)" value={data?.totalSaidasWeek} loading={isLoading} subtext={`${data?.totalOpsWeek ?? 0} iniciadas`} />
        <Kpi icon={Trophy} label="Win Rate" value={`${data?.winRate ?? 0}%`} loading={isLoading} tone={data?.winRate && data.winRate >= 60 ? "success" : data?.winRate && data.winRate >= 40 ? "warning" : "destructive"} />
        <Kpi icon={Swords} label="Kills/Saída" value={data?.avgKillsPerSaida ?? 0} loading={isLoading} tone="destructive" />
      </Stagger>

      <ProfileCard
        member={me.data ?? null}
        xp={myXP.data ?? null}
        stats={myStats.data ?? null}
      />

      {(data?.lastSaida || (data?.topOpsParticipants && data.topOpsParticipants.length > 0)) && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {data?.lastSaida && (
            <Reveal delay={100} direction="up">
              <Card className={data.lastSaida.was_profitable ? "border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 via-card to-card interactive-card" : "border-destructive/20 bg-gradient-to-br from-destructive/5 via-card to-card interactive-card"}>
                <CardContent className="flex items-start gap-4 p-5">
                  <span className={data.lastSaida.was_profitable ? "grid h-12 w-12 place-items-center rounded-full bg-emerald-500/20 ring-1 ring-emerald-500/40 shrink-0" : "grid h-12 w-12 place-items-center rounded-full bg-destructive/20 ring-1 ring-destructive/40 shrink-0"}>
                    {data.lastSaida.was_profitable ? <Trophy className="h-6 w-6 text-emerald-400" /> : <Skull className="h-6 w-6 text-destructive" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={data.lastSaida.was_profitable ? "text-display text-[11px] tracking-[0.3em] text-emerald-400 uppercase" : "text-display text-[11px] tracking-[0.3em] text-destructive uppercase"}>
                      Última saída · {data.lastSaida.was_profitable ? "Vitória" : "Derrota"}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-lg font-semibold">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{data.lastSaida.spot ?? "Spot não definido"}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {data.lastSaida.tipo ?? "Saída"} ·{" "}
                      {data.lastSaida.scheduled_at
                        ? new Date(data.lastSaida.scheduled_at).toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                        : "Data por definir"}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                      <span className="inline-flex items-center gap-1 text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        {data.lastSaida.survivors} sobrevivente{data.lastSaida.survivors !== 1 ? "s" : ""}
                      </span>
                      <span className="inline-flex items-center gap-1 text-destructive">
                        <span className="h-1.5 w-1.5 rounded-full bg-destructive" />
                        {data.lastSaida.deaths} morto{data.lastSaida.deaths !== 1 ? "s" : ""}
                      </span>
                      {data.lastSaida.our_kills != null && (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Crosshair className="h-3 w-3" />
                          {data.lastSaida.our_kills} kill{data.lastSaida.our_kills !== 1 ? "s" : ""}
                        </span>
                      )}
                      {data.lastSaida.mvp_name && (
                        <span className="inline-flex items-center gap-1 text-warning">
                          <Sparkles className="h-3 w-3" />
                          MVP: {data.lastSaida.mvp_name} ({data.lastSaida.mvp_kills})
                        </span>
                      )}
                    </div>
                  </div>
                  <Link to="/operacoes" className="text-display cursor-pointer text-[10px] tracking-[0.2em] interactive-link shrink-0">
                    VER SAÍDAS →
                  </Link>
                </CardContent>
              </Card>
            </Reveal>
          )}

          {data?.topOpsParticipants && data.topOpsParticipants.length > 0 && (
            <Reveal delay={180} direction="up">
              <Card className="interactive-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-display text-sm flex items-center gap-2">
                    <Crosshair className="h-4 w-4 text-primary" />
                    Mais ativos (saídas)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {data.topOpsParticipants.map((p, i) => (
                      <div key={i} className="flex items-center gap-3 interactive-row rounded-sm px-2 py-1.5">
                        <span className="grid w-6 place-items-center text-xs text-muted-foreground">
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                        </span>
                        <TierIcon tier={p.tier} size="sm" />
                        <span className="flex-1 truncate text-sm">{p.display_name ?? "—"}</span>
                        <span className="text-display text-sm tabular-nums">{p.ops}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Reveal>
          )}
        </div>
      )}

      {data?.prize && (
        <Reveal delay={200} direction="up">
          <Card className={cn(
            "mt-6 interactive-card",
            data.prize.status === "in_progress"
              ? "border-orange-500/40 bg-gradient-to-br from-orange-500/10 via-card to-card"
              : "border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card"
          )}>
            <CardContent className="flex items-start gap-4 p-5">
              <span className={cn(
                "grid h-12 w-12 shrink-0 place-items-center rounded-full ring-1",
                data.prize.status === "in_progress"
                  ? "bg-orange-500/20 ring-orange-500/40"
                  : "bg-primary/20 ring-primary/40"
              )}>
                {data.prize.status === "in_progress" ? (
                  <Flame className="h-6 w-6 text-orange-400" />
                ) : (
                  <Sparkles className="h-6 w-6 text-primary" />
                )}
              </span>
              <div className="flex-1 min-w-0">
                {/* Semana + estado */}
                <div className="flex items-center gap-2">
                  <div className="text-display text-[11px] tracking-[0.3em] text-primary uppercase">
                    Semana {data.prize.week_label}
                  </div>
                  {data.prize.status === "in_progress" && (
                    <Badge variant="default" className="bg-orange-500 text-white border-transparent text-[10px]">
                      <Flame className="w-3 h-3 mr-1" />
                      A decorrer
                    </Badge>
                  )}
                </div>

                {/* Vencedor (sempre o líder / calculado) */}
                <div className="mt-1 flex items-center gap-2 text-lg font-semibold">
                  <TierIcon tier={data.prize.winner_tier} size="sm" />
                  <span className="truncate">{data.prize.winner_name}</span>
                  {data.prize.score != null && (
                    <span className="text-sm font-mono text-muted-foreground">· {fmtNum(Math.round(data.prize.score))} pts</span>
                  )}
                </div>

                {/* Prémio — separado e destacado */}
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-display text-[10px] uppercase tracking-wider text-muted-foreground">Prémio:</span>
                  {!data.prize.prize_description ? (
                    <Badge variant="outline" className="text-[10px] border-yellow-500/50 text-yellow-400 bg-yellow-500/10">
                      Por definir
                    </Badge>
                  ) : data.prize.prize_status === "entregue" ? (
                    <Badge variant="default" className="text-[10px] bg-green-600 text-white border-transparent">
                      Entregue
                    </Badge>
                  ) : (
                    <Badge variant="default" className="text-[10px] bg-purple-600 text-white border-transparent">
                      Definido
                    </Badge>
                  )}
                </div>
                {data.prize.prize_description ? (
                  <div className="mt-0.5 text-sm font-medium text-foreground">{data.prize.prize_description}</div>
                ) : (
                  <div className="mt-0.5 text-xs text-muted-foreground italic">A chefia ainda não definiu o prémio desta semana.</div>
                )}
              </div>
              <Link to="/premios" className="text-display cursor-pointer text-[10px] tracking-[0.2em] text-primary interactive-link shrink-0 mt-1">
                VER PRÉMIOS →
              </Link>
            </CardContent>
          </Card>
        </Reveal>
      )}

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Reveal delay={100} direction="up">
          <Card className="interactive-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-display text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Hierarquia do bairro
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {(() => {
                const rows = data?.byTier ?? [];
                const max = Math.max(1, ...rows.map((r) => Number(r.count) || 0));
                const sorted = [...rows].sort((a, b) => TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier));
                const total = sorted.reduce((sum, t) => sum + Number(t.count), 0);
                return (
                  <>
                    <div className="mb-3 text-[11px] text-muted-foreground">{fmtNum(total)} membros ativos no total</div>
                    <ul className="space-y-3">
                      {sorted.map((t) => {
                        const n = Number(t.count) || 0;
                        const pct = Math.max(4, Math.round((n / max) * 100));
                        const pctOfTotal = total > 0 ? Math.round((n / total) * 100) : 0;
                        const topMembers = (data?.topByTier ?? []).filter((m) => m.tier === t.tier).slice(0, 3);
                        return (
                          <li key={t.tier} className="interactive-row rounded-sm px-2 py-1.5">
                            <div className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-2">
                                <TierIcon tier={t.tier} size="sm" />
                                <span className="font-medium">{TIER_LABELS[t.tier] ?? t.tier}</span>
                              </span>
                              <span className="text-display tabular-nums text-xs">
                                {fmtNum(n)} <span className="text-muted-foreground/60">({pctOfTotal}%)</span>
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted mt-1">
                              <div className="h-full bg-primary/70 transition-all duration-700" style={{ width: `${pct}%` }} />
                            </div>
                            {topMembers.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {topMembers.map((m, i) => (
                                  <span key={i} className="inline-flex items-center gap-1 rounded-sm bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                    <span className="truncate max-w-[80px]">{m.name ?? "—"}</span>
                                    <span className="font-mono text-[9px] opacity-60">{fmtNum(Math.round(m.score))} pts</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </li>
                        );
                      })}
                      {!sorted.length && !isLoading && <li className="text-sm text-muted-foreground">Sem dados.</li>}
                    </ul>
                  </>
                );
              })()}
            </CardContent>
          </Card>
        </Reveal>

        <Reveal delay={180} direction="up">
          <Card className="interactive-card">
            <CardHeader>
              <CardTitle className="text-display text-sm flex items-center gap-2">
                <Trophy className="h-4 w-4 text-warning" />
                Quem está a marcar pontos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <TopList icon={<Flame className="h-3.5 w-3.5 text-destructive" />} title="Esta semana" subtitle={data?.topWeekLabel ? formatWeek(data.topWeekLabel) : null} rows={data?.topWeek} loading={isLoading} />
              <TopList icon={<CalendarDays className="h-3.5 w-3.5 text-info" />} title="Semana passada" subtitle={data?.topPrevWeekLabel ? formatWeek(data.topPrevWeekLabel) : null} rows={data?.topPrevWeek} loading={isLoading} compact />
              <TopList icon={<Trophy className="h-3.5 w-3.5 text-warning" />} title="Mês" subtitle={data?.topMonthLabel ?? null} rows={data?.topMonth} loading={isLoading} compact />
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </>
  );
}

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

const MEDAL_ICONS = [
  { Cmp: Trophy, cls: "text-warning" },
  { Cmp: Medal, cls: "text-muted-foreground" },
  { Cmp: Award, cls: "text-orange-400" },
] as const;

function TopList({ title, icon, subtitle, rows, loading, compact }: {
  title: string; icon?: React.ReactNode; subtitle?: string | null; rows?: RankRow[]; loading?: boolean; compact?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="inline-flex items-center gap-1.5 text-display text-xs tracking-[0.2em] text-muted-foreground">
          {icon}{title}
        </span>
        {subtitle && <span className="text-[10px] text-muted-foreground/70">{subtitle}</span>}
      </div>
      <ol className="space-y-1">
        {(rows ?? []).map((m, i) => {
          const name = m.display_name ?? m.nick ?? "Anónimo";
          const bits: string[] = [];
          if (m.ops) bits.push(`${m.ops} saída${m.ops > 1 ? "s" : ""}`);
          if (m.kills_count) bits.push(`${m.kills_count} kill${m.kills_count > 1 ? "s" : ""}`);
          if (m.wins_count) bits.push(`${m.wins_count} win${m.wins_count > 1 ? "s" : ""}`);
          if (m.material_points) bits.push(`${fmtNum(m.material_points)} mat`);
          if (m.sales_points) bits.push(`${fmtNum(m.sales_points)} vendas`);
          const medal = MEDAL_ICONS[i];
          return (
            <li key={i} className={cn("flex items-center gap-3 rounded-sm px-2", compact ? "py-1.5" : "py-2", i === 0 ? " bg-primary/5" : "")}>
              <span className="grid w-7 place-items-center">
                {medal ? <medal.Cmp className={cn("h-4 w-4", medal.cls)} /> : <span className="text-muted-foreground text-xs">#{i + 1}</span>}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{name}</div>
                {!compact && bits.length > 0 && <div className="text-[11px] text-muted-foreground">{bits.join(" · ")}</div>}
              </div>
              <span className="text-display tabular-nums text-sm">{fmtNum(Math.round(m.score))}</span>
            </li>
          );
        })}
        {!rows?.length && !loading && <li className="px-2 py-1.5 text-xs text-muted-foreground">Ainda sem pontos.</li>}
      </ol>
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

function Kpi({ label, value, loading, accent, icon: Icon, tone, subtext }: {
  label: string; value?: number | string; loading: boolean; accent?: boolean; tone?: "destructive" | "success" | "warning"; icon?: React.ComponentType<{ className?: string }>; subtext?: string;
}) {
  const valueColor = accent ? "text-primary" : tone === "destructive" ? "text-destructive" : tone === "success" ? "text-emerald-400" : tone === "warning" ? "text-amber-400" : "text-foreground";
  const iconColor = accent ? "text-primary" : tone === "destructive" ? "text-destructive" : tone === "success" ? "text-emerald-400" : tone === "warning" ? "text-amber-400" : "text-muted-foreground/60";
  return (
    <div className={cn("rounded-xl border bg-card/60 p-4 backdrop-blur-sm interactive-card", accent ? "border-primary/40" : "border-border/60")}>
      <div className="flex items-center justify-between">
        <div className="text-display text-[11px] tracking-[0.18em] text-muted-foreground uppercase">{label}</div>
        {Icon && <Icon className={cn("h-4 w-4", iconColor)} />}
      </div>
      <div className={cn("mt-1 text-3xl font-bold tabular-nums font-display", valueColor)}>
        {loading ? "" : typeof value === "number" ? fmtNum(value) : value}
      </div>
      {subtext && <div className="mt-1 text-[10px] text-muted-foreground/60">{subtext}</div>}
    </div>
  );
}
