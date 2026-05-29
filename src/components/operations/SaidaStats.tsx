import { cn } from "@/lib/utils";
import { fmtNum } from "@/lib/domain";
import {
  Crosshair,
  Trophy,
  Skull,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import type { SaidaRow } from "@/lib/operations.functions";

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  accent,
  delay = 0,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  subtext?: string;
  accent?: "primary" | "success" | "warning" | "destructive" | "muted";
  delay?: number;
}) {
  const accentClasses = {
    primary: "bg-primary/10 text-primary border-primary/30",
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    destructive: "bg-destructive/10 text-destructive border-destructive/30",
    muted: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 rounded-xl border p-3 backdrop-blur-sm animate-rise",
        accentClasses[accent ?? "muted"],
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          accent === "primary" && "bg-primary/20",
          accent === "success" && "bg-emerald-500/20",
          accent === "warning" && "bg-amber-500/20",
          accent === "destructive" && "bg-destructive/20",
          accent === "muted" && "bg-muted/80",
        )}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider opacity-70">{label}</div>
        <div className="text-xl font-bold font-display">{value}</div>
        {subtext && <div className="text-[10px] opacity-50">{subtext}</div>}
      </div>
    </div>
  );
}

export function SaidaStats({ saidas }: { saidas: SaidaRow[] }) {
  // Só contabiliza saídas onde houve fight
  const fightSaidas = saidas.filter((s) => s.had_fight === true);

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const thisWeek = fightSaidas.filter(
    (s) => s.scheduled_at && new Date(s.scheduled_at) >= weekAgo,
  );

  const totalSaidas = fightSaidas.length;
  const thisWeekCount = thisWeek.length;

  // Win rate: saídas concluídas com was_profitable = true
  const withResult = fightSaidas.filter(
    (s) => s.status === "concluida",
  );
  const wins = withResult.filter((s) => s.was_profitable === true).length;
  const winRate = withResult.length > 0 ? Math.round((wins / withResult.length) * 100) : 0;

  // Kills per saída (média)
  const totalKills = fightSaidas.reduce((sum, s) => sum + (s.our_kills ?? 0), 0);
  const avgKills =
    withResult.length > 0 ? (totalKills / withResult.length).toFixed(1) : "0";

  // Avg participants
  const avgParticipants =
    fightSaidas.length > 0
      ? (fightSaidas.reduce((sum, s) => sum + (s.participant_count ?? 0), 0) / fightSaidas.length).toFixed(1)
      : "0";

  // Trend vs last week
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const lastWeek = fightSaidas.filter(
    (s) =>
      s.scheduled_at &&
      new Date(s.scheduled_at) >= twoWeeksAgo &&
      new Date(s.scheduled_at) < weekAgo,
  );
  const trend =
    lastWeek.length > 0
      ? Math.round(((thisWeekCount - lastWeek.length) / lastWeek.length) * 100)
      : 0;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        icon={Crosshair}
        label="Saídas (7d)"
        value={fmtNum(thisWeekCount)}
        subtext={
          trend > 0
            ? `+${trend}% vs semana ant.`
            : trend < 0
              ? `${trend}% vs semana ant.`
              : "Igual à semana ant."
        }
        accent="primary"
        delay={0}
      />
      <StatCard
        icon={Trophy}
        label="Taxa de Vitórias"
        value={`${winRate}%`}
        subtext={`${wins}/${withResult.length} vitórias`}
        accent={winRate >= 60 ? "success" : winRate >= 40 ? "warning" : "destructive"}
        delay={100}
      />
      <StatCard
        icon={Skull}
        label="Abates/Saída"
        value={avgKills}
        subtext={`${fmtNum(totalKills)} abates totais`}
        accent="success"
        delay={200}
      />
      <StatCard
        icon={Users}
        label="Média Equipa"
        value={avgParticipants}
        subtext="membros por saída"
        accent="muted"
        delay={300}
      />
    </div>
  );
}
