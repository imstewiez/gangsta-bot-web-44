import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { useState } from "react";
import {
  getLeaderboard,
  type LeaderboardPeriod,
  type LeaderboardSortBy,
} from "@/lib/leaderboard.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtNum } from "@/lib/domain";
import { TierIcon } from "@/components/domain/TierIcon";
import {
  Trophy,
  Medal,
  Award,
  Skull,
  Crosshair,
  Truck,
  Package,
  Swords,
  Flame,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
} from "lucide-react";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Reveal } from "@/components/layout/Reveal";

export const Route = createFileRoute("/_authenticated/tops")({
  head: () => ({
    meta: [{ title: "Leaderboard | Ballas Gang" }],
  }),
  component: Page,
});

const MEDAL_ICONS = [
  { Cmp: Trophy, cls: "text-warning" },
  { Cmp: Medal, cls: "text-muted-foreground" },
  { Cmp: Award, cls: "text-orange-400" },
] as const;

const COLUMNS: {
  key: LeaderboardSortBy;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  align?: "left" | "right";
}[] = [
  { key: "kills", label: "Kills", icon: Skull, align: "right" },
  { key: "deaths", label: "Mortes", icon: Flame, align: "right" },
  { key: "kd", label: "K/D", align: "right" },
  { key: "deliveries", label: "Entregas", icon: Truck, align: "right" },
  { key: "sales", label: "Vendas", icon: Package, align: "right" },
  { key: "ops", label: "Saídas", icon: Crosshair, align: "right" },
  { key: "wins", label: "Vit.", icon: Swords, align: "right" },
  { key: "score", label: "Score", align: "right" },
];

function Page() {
  useRealtimeSync([
    { table: "all_time_stats", queryKeys: [["leaderboard"]] },
    { table: "kill_logs", queryKeys: [["leaderboard"]] },
  ]);
  const fn = useAuthedServerFn(getLeaderboard);
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");
  const [sortBy, setSortBy] = useState<LeaderboardSortBy>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const { data, isLoading, error } = useQuery({
    queryKey: ["leaderboard", period, sortBy, sortDir],
    queryFn: () => fn({ data: { period, sortBy, sortDir } }),
  });

  function toggleSort(col: LeaderboardSortBy) {
    if (sortBy === col) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  }

  function SortIcon({ col }: { col: LeaderboardSortBy }) {
    if (sortBy !== col) return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    return sortDir === "desc" ? (
      <ArrowDown className="h-3 w-3 text-primary" />
    ) : (
      <ArrowUp className="h-3 w-3 text-primary" />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Bairro"
        title="Leaderboard"
        description="Rankings e estatísticas"
        icon={Trophy}
        action={
          <Tabs
            value={period}
            onValueChange={(v) => setPeriod(v as LeaderboardPeriod)}
          >
            <TabsList>
              <TabsTrigger value="week" className="interactive-tab">Semana</TabsTrigger>
              <TabsTrigger value="month" className="interactive-tab">Mês</TabsTrigger>
              <TabsTrigger value="all" className="interactive-tab">Tudo</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      <div className="overflow-x-auto overflow-hidden rounded-sm border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-display text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <tr className="interactive-row">
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Membro</th>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className={`px-3 py-2 cursor-pointer hover:text-primary hover:shadow-[0_0_12px_-4px_rgba(168,85,247,0.2)] transition-all select-none ${
                    c.align === "right" ? "text-right" : "text-left"
                  }`}
                  onClick={() => toggleSort(c.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.icon && <c.icon className="h-3 w-3" />}
                    {c.label}
                    <SortIcon col={c.key} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr className="interactive-row">
                <td
                  colSpan={10}
                  className="p-6 text-center"
                >
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                </td>
              </tr>
            )}
            {error && (
              <tr className="interactive-row">
                <td colSpan={10} className="p-6 text-center text-destructive">
                  Erro: {(error as any)?.message ?? String(error)}
                </td>
              </tr>
            )}
            {!isLoading && !error &&
              (data ?? []).map((r, i) => {
                const medal = MEDAL_ICONS[i];
                return (
                  <tr
                    key={r.member_id}
                    className="border-t border-border interactive-row cursor-pointer"
                  >
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 text-display text-primary">
                        {medal ? (
                          <medal.Cmp className={"h-4 w-4 " + medal.cls} />
                        ) : null}
                        <span className="tabular-nums">{i + 1}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-2 font-medium">
                        <TierIcon tier={r.tier} size="sm" />
                        {r.display_name ?? r.nick ?? "—"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {fmtNum(r.kills)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                      {fmtNum(r.deaths)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {r.kd != null ? r.kd.toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {fmtNum(r.deliveries)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {fmtNum(r.sales)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {fmtNum(r.ops)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-success">
                      {fmtNum(r.wins)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-primary">
                      {fmtNum(Math.round(r.score))}
                    </td>
                  </tr>
                );
              })}
            {!isLoading && !error && !data?.length && (
              <tr className="interactive-row">
                <td
                  colSpan={10}
                  className="p-6 text-center text-muted-foreground"
                >
                  Sem ranking.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
