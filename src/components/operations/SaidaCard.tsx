import { useNavigate } from "@tanstack/react-router";
import { SaidaStatusBadge, statusProgress } from "./SaidaStatusBadge";
import { fmtDate, fmtNum } from "@/lib/domain";
import { cn } from "@/lib/utils";
import {
  Crosshair,
  Skull,
  Users,
  Calendar,
  ArrowRight,
  Swords,
  MapPin,
  Clock,
  Trophy,
  ShieldAlert,
  Shield,
} from "lucide-react";
import type { SaidaRow, ParticipantStat } from "@/lib/operations.functions";

const TYPE_STYLES: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  ataque: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/30",
    icon: "text-red-400",
  },
  recolha: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    border: "border-blue-500/30",
    icon: "text-blue-400",
  },
  craft: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    icon: "text-emerald-400",
  },
  dominio: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/30",
    icon: "text-amber-400",
  },
  defesa: {
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    border: "border-purple-500/30",
    icon: "text-purple-400",
  },
  outra: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
    icon: "text-muted-foreground",
  },
  outro: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
    icon: "text-muted-foreground",
  },
};

const TYPE_LABELS: Record<string, string> = {
  ataque: "Saída",
  recolha: "Pista",
  craft: "Fabricação",
  dominio: "Domínio",
  defesa: "Defesa",
  outra: "Outra",
  outro: "Outro",
};

function TypeBadge({ type }: { type: string | null }) {
  const t = (type ?? "outro").toLowerCase();
  const style = TYPE_STYLES[t] ?? TYPE_STYLES.outro;
  const label = TYPE_LABELS[t] ?? type ?? "Outro";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        style.bg,
        style.text,
        style.border,
      )}
    >
      <Crosshair className={cn("h-3 w-3", style.icon)} />
      {label}
    </span>
  );
}

function WinLossBadge({ wasProfitable }: { wasProfitable: boolean | null }) {
  if (wasProfitable === true)
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
        <Trophy className="h-3 w-3" /> Vitória
      </span>
    );
  if (wasProfitable === false)
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-400">
        <ShieldAlert className="h-3 w-3" /> Derrota
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      <Shield className="h-3 w-3" /> Sem resultado
    </span>
  );
}

function ParticipantAvatars({ participants }: { participants: ParticipantStat[] }) {
  const visible = participants.slice(0, 3);
  const remaining = participants.length - visible.length;
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {visible.map((p, i) => (
          <div
            key={p.member_id}
            className={cn(
              "relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-card text-[10px] font-bold",
              i === 0 && "bg-primary/20 text-primary",
              i === 1 && "bg-accent/20 text-accent-foreground",
              i === 2 && "bg-secondary text-secondary-foreground",
            )}
            title={p.member_name ?? `Membro #${p.member_id}`}
          >
            {(p.member_name ?? "?")
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </div>
        ))}
      </div>
      {remaining > 0 && (
        <span className="ml-2 text-[10px] text-muted-foreground">
          +{remaining}
        </span>
      )}
      {participants.length === 0 && (
        <span className="text-[10px] text-muted-foreground">Sem equipa</span>
      )}
    </div>
  );
}

function MiniStat({
  icon: Icon,
  value,
  label,
  accent = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: React.ReactNode;
  label: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon
        className={cn(
          "h-3.5 w-3.5",
          accent ? "text-primary" : "text-muted-foreground/60",
        )}
      />
      <span className="text-xs font-medium">{value}</span>
      <span className="text-[10px] text-muted-foreground/60">{label}</span>
    </div>
  );
}

export function SaidaCard({
  saida,
  index = 0,
}: {
  saida: SaidaRow;
  index?: number;
}) {
  const progress = statusProgress(saida.status);
  const isFinalized = saida.status === "concluida" || saida.status === "cancelada";
  const isInProgress = saida.status === "em_curso";

  // Calculate kills/deaths from participants
  const totalKills = saida.participants_json?.reduce((sum, p) => sum + (p.kills ?? 0), 0) ?? 0;
  const totalDeaths = saida.participants_json?.reduce((sum, p) => sum + (p.deaths_count ?? 0), 0) ?? 0;

  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate({ to: "/operacoes/$id", params: { id: String(saida.id) } })}
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border p-4 transition-all duration-300 cursor-pointer",
        "bg-card/60 backdrop-blur-sm interactive-card",
        isInProgress && "border-primary/40 shadow-[0_0_20px_-8px_rgba(168,85,247,0.25)]",
        !isInProgress && "border-border/60",
        isFinalized && saida.was_profitable === true && "border-emerald-500/30",
        isFinalized && saida.was_profitable === false && "border-red-500/30",
        isFinalized && saida.was_profitable === null && "opacity-70 hover:opacity-100",
        "animate-rise",
      )}
      style={{ animationDelay: `${Math.min(index * 60, 400)}ms` }}
    >
      {/* Top row: Type + Status + Win/Loss */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={saida.tipo} />
          {isFinalized && <WinLossBadge wasProfitable={saida.was_profitable} />}
        </div>
        <SaidaStatusBadge status={saida.status} pulse={isInProgress} />
      </div>

      {/* Title: Spot + ID */}
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-muted-foreground/50" />
        <h3 className="text-lg font-bold leading-tight">
          {saida.spot ?? "Local por definir"}
        </h3>
        <span className="ml-auto text-[10px] text-muted-foreground/40 font-mono">
          #{saida.id}
        </span>
      </div>

      {/* Enemy info */}
      {saida.enemy_name && (
        <div className="text-xs text-muted-foreground">
          vs {saida.enemy_name}
          {saida.enemy_faction ? ` · ${saida.enemy_faction}` : ""}
        </div>
      )}

      {/* Progress bar */}
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            saida.status === "em_curso" && "bg-primary",
            saida.status === "concluida" && saida.was_profitable === true && "bg-emerald-500",
            saida.status === "concluida" && saida.was_profitable === false && "bg-red-500",
            saida.status === "concluida" && saida.was_profitable === null && "bg-emerald-500",
            saida.status === "em_liquidacao" && "bg-orange-500",
            saida.status === "criada" && "bg-amber-500",
            saida.status === "trancagem" && "bg-slate-500",
            saida.status === "em_preparacao" && "bg-cyan-500",
            saida.status === "cancelada" && "bg-destructive/50",
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        <MiniStat
          icon={Calendar}
          value={saida.scheduled_at ? fmtDate(saida.scheduled_at).split(" ")[0] : "—"}
          label="Data"
        />
        <MiniStat
          icon={Users}
          value={fmtNum(saida.participant_count)}
          label="Membros"
          accent={saida.participant_count > 5}
        />
        <MiniStat
          icon={Swords}
          value={`${fmtNum(totalKills)}/${fmtNum(totalDeaths)}`}
          label="R/A"
          accent={totalKills > totalDeaths}
        />
        <MiniStat
          icon={Clock}
          value={
            saida.finalized_at
              ? fmtDate(saida.finalized_at).split(" ")[0]
              : "—"
          }
          label="Fim"
        />
      </div>

      {/* Bottom: Avatars + Arrow */}
      <div className="flex items-center justify-between border-t border-border/40 pt-3">
        <ParticipantAvatars participants={saida.participants_json ?? []} />
        <ArrowRight className="h-4 w-4 text-muted-foreground/30 transition-all group-hover:text-primary group-hover:translate-x-1" />
      </div>
    </div>
  );
}
