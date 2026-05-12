import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardKpis } from "@/lib/dashboard.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtNum, TIER_LABELS, TIER_ORDER } from "@/lib/domain";
import { TierIcon } from "@/components/domain/TierIcon";
import { Flame, CalendarDays, Trophy, Medal, Award } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function Dashboard() {
  const fn = useServerFn(getDashboardKpis);
  const { profile } = useAuth();
  const { data, isLoading, error } = useQuery({ queryKey: ["dashboard"], queryFn: () => fn() });

  const h = new Date().getHours();
  const saud = h < 5 ? "Ainda na rua" : h < 12 ? "Bom dia" : h < 19 ? "Boa tarde" : "Boa noite";
  const nome = profile?.display_name?.split(" ")[0] ?? "mano";

  return (
    <>
      <PageHeader
        eyebrow="Casa"
        title={`${saud}, ${nome}.`}
        description="O que se passa no bairro, agora."
      />
      {error && <p className="text-destructive text-sm">Caiu qualquer coisa: {(error as Error).message}</p>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Gente da casa" value={data?.totalMembers} loading={isLoading} accent />
        <Kpi label="Saídas em aberto" value={data?.openSaidas} loading={isLoading} />
        <Kpi label="Tags por tratar" value={data?.pendingTagRequests} loading={isLoading} />
        <Kpi label="Stock no armazém" value={data?.totalStock} loading={isLoading} />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-display text-sm">Hierarquia do bairro</CardTitle></CardHeader>
          <CardContent>
            {(() => {
              const rows = data?.byTier ?? [];
              const max = Math.max(1, ...rows.map((r) => Number(r.count) || 0));
              const sorted = [...rows].sort(
                (a, b) => TIER_ORDER.indexOf(b.tier) - TIER_ORDER.indexOf(a.tier),
              );
              return (
                <ul className="space-y-3">
                  {sorted.map((t) => {
                    const n = Number(t.count) || 0;
                    const pct = Math.max(4, Math.round((n / max) * 100));
                    return (
                      <li key={t.tier} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2">
                            <TierIcon tier={t.tier} size="sm" />
                            <span className="font-medium">{TIER_LABELS[t.tier] ?? t.tier}</span>
                          </span>
                          <span className="text-display tabular-nums">{fmtNum(n)}</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full bg-primary/70" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                  {!sorted.length && !isLoading && <li className="text-sm text-muted-foreground">Sem dados.</li>}
                </ul>
              );
            })()}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-display text-sm">Quem está a marcar pontos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <TopList
              title="🔥 Esta semana"
              subtitle={data?.topWeekLabel ? formatWeek(data.topWeekLabel) : null}
              rows={data?.topWeek}
              loading={isLoading}
            />
            <TopList
              title="📅 Semana passada"
              subtitle={data?.topPrevWeekLabel ? formatWeek(data.topPrevWeekLabel) : null}
              rows={data?.topPrevWeek}
              loading={isLoading}
              compact
            />
            <TopList
              title="🏆 Mês"
              subtitle={data?.topMonthLabel ?? null}
              rows={data?.topMonth}
              loading={isLoading}
              compact
            />
          </CardContent>
        </Card>

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
};

const MEDALS = ["🥇", "🥈", "🥉"];

function TopList({
  title,
  subtitle,
  rows,
  loading,
  compact,
}: {
  title: string;
  subtitle?: string | null;
  rows?: RankRow[];
  loading?: boolean;
  compact?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-display text-xs tracking-[0.2em] text-muted-foreground">{title}</span>
        {subtitle && <span className="text-[10px] text-muted-foreground/70">{subtitle}</span>}
      </div>
      <ol className="space-y-1">
        {(rows ?? []).map((m, i) => {
          const name = m.display_name ?? m.nick ?? "Anónimo";
          const bits: string[] = [];
          if (m.deliveries) bits.push(`${m.deliveries} entregas`);
          if (m.sales) bits.push(`${m.sales} vendas`);
          if (m.ops) bits.push(`${m.ops} saídas`);
          return (
            <li
              key={i}
              className={
                "flex items-center gap-3 rounded-sm px-2 " +
                (compact ? "py-1.5" : "py-2") +
                (i === 0 ? " bg-primary/5" : "")
              }
            >
              <span className="w-7 text-display text-base">
                {MEDALS[i] ?? <span className="text-muted-foreground text-xs">#{i + 1}</span>}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{name}</div>
                {!compact && bits.length > 0 && (
                  <div className="text-[11px] text-muted-foreground">{bits.join(" · ")}</div>
                )}
              </div>
              <span className="text-display tabular-nums text-sm">{fmtNum(Math.round(m.score))}</span>
            </li>
          );
        })}
        {!rows?.length && !loading && (
          <li className="px-2 py-1.5 text-xs text-muted-foreground">Ainda sem pontos.</li>
        )}
      </ol>
    </div>
  );
}

function formatWeek(weekStart: string): string {
  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const f = (d: Date) =>
    new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "short" }).format(d);
  return `${f(start)} – ${f(end)}`;
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
