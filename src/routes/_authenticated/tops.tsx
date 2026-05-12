import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getWeeklyTop } from "@/lib/operations.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { fmtNum } from "@/lib/domain";
import { Trophy, Medal, Award } from "lucide-react";

export const Route = createFileRoute("/_authenticated/tops")({ component: Page });

const MEDAL_ICONS = [
  { Cmp: Trophy, cls: "text-warning" },
  { Cmp: Medal,  cls: "text-muted-foreground" },
  { Cmp: Award,  cls: "text-orange-400" },
] as const;

function Page() {
  const fn = useServerFn(getWeeklyTop);
  const { data, isLoading } = useQuery({ queryKey: ["weeklyTop"], queryFn: () => fn() });
  return (
    <>
      <PageHeader eyebrow="Ranking" title="Top Semanal" description="Contribuição · Performance · Fiabilidade." />
      <div className="overflow-hidden rounded-sm border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-display text-xs">
            <tr><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Membro</th>
            <th className="px-3 py-2 text-right">Contrib.</th><th className="px-3 py-2 text-right">Perform.</th>
            <th className="px-3 py-2 text-right">Fiabil.</th><th className="px-3 py-2 text-right">Score</th></tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">A carregar…</td></tr>}
            {(data ?? []).map((r, i) => (
              <tr key={r.member_id} className="border-t border-border hover:bg-accent/30">
                <td className="px-3 py-2 text-display text-primary">{i + 1}</td>
                <td className="px-3 py-2 font-medium">{r.display_name ?? r.nick ?? "—"}</td>
                <td className="px-3 py-2 text-right font-mono text-xs">{r.contribution != null ? fmtNum(Math.round(r.contribution)) : "—"}</td>
                <td className="px-3 py-2 text-right font-mono text-xs">{r.performance != null ? fmtNum(Math.round(r.performance)) : "—"}</td>
                <td className="px-3 py-2 text-right font-mono text-xs">{r.reliability != null ? fmtNum(Math.round(r.reliability)) : "—"}</td>
                <td className="px-3 py-2 text-right font-mono font-bold">{fmtNum(Math.round(r.score))}</td>
              </tr>
            ))}
            {!isLoading && !data?.length && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Sem ranking.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
