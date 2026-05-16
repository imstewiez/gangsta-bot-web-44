import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { useState } from "react";
import {
  getLeaderboard,
  type LeaderboardPeriod,
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
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/tops")({
  component: Page,
});

const MEDAL_ICONS = [
  { Cmp: Trophy, cls: "text-warning" },
  { Cmp: Medal, cls: "text-muted-foreground" },
  { Cmp: Award, cls: "text-orange-400" },
] as const;

function Page() {
  const fn = useAuthedServerFn(getLeaderboard);
  const [period, setPeriod] = useState<LeaderboardPeriod>("week");
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", period],
    queryFn: () => fn({ data: { period } }),
  });

  return (
    <>
      <PageHeader
        eyebrow="Bairro"
        title="Leaderboard"
        description="Stats de toda a malta. Quem mata, quem entrega, quem vende, quem aparece nas saídas."
        icon={Trophy}
        action={
          <Tabs
            value={period}
            onValueChange={(v) => setPeriod(v as LeaderboardPeriod)}
          >
            <TabsList>
              <TabsTrigger value="week">Semana</TabsTrigger>
              <TabsTrigger value="month">Mês</TabsTrigger>
              <TabsTrigger value="all">Tudo</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      <div className="overflow-x-auto overflow-hidden rounded-sm border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-display text-[11px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Membro</th>
              <th className="px-3 py-2 text-right">
                <span className="inline-flex items-center justify-end gap-1">
                  <Skull className="h-3 w-3" />
                  Kills
                </span>
              </th>
              <th className="px-3 py-2 text-right">
                <span className="inline-flex items-center justify-end gap-1">
                  <Flame className="h-3 w-3" />
                  Mortes
                </span>
              </th>
              <th className="px-3 py-2 text-right">K/D</th>
              <th className="px-3 py-2 text-right">
                <span className="inline-flex items-center justify-end gap-1">
                  <Truck className="h-3 w-3" />
                  Entregas
                </span>
              </th>
              <th className="px-3 py-2 text-right">
                <span className="inline-flex items-center justify-end gap-1">
                  <Package className="h-3 w-3" />
                  Vendas
                </span>
              </th>
              <th className="px-3 py-2 text-right">
                <span className="inline-flex items-center justify-end gap-1">
                  <Crosshair className="h-3 w-3" />
                  Saídas
                </span>
              </th>
              <th className="px-3 py-2 text-right">
                <span className="inline-flex items-center justify-end gap-1">
                  <Swords className="h-3 w-3" />
                  Vit.
                </span>
              </th>
              <th className="px-3 py-2 text-right">Score</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td
                  colSpan={10}
                  className="p-6 text-center text-muted-foreground"
                >
                  A carregar…
                </td>
              </tr>
            )}
            {(data ?? []).map((r, i) => {
              const medal = MEDAL_ICONS[i];
              return (
                <tr
                  key={r.member_id}
                  className="border-t border-border hover:bg-accent/30"
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
            {!isLoading && !data?.length && (
              <tr>
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
