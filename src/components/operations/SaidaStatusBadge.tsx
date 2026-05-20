import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; color: string; glow: string }> = {
  criada: {
    label: "Plan",
    color: "bg-amber-500/15 text-amber-400 border-amber-500/40",
    glow: "shadow-[0_0_12px_-2px_rgba(251,191,36,0.35)]",
  },
  trancagem: {
    label: "Trancagem",
    color: "bg-slate-500/15 text-slate-400 border-slate-500/40",
    glow: "",
  },
  em_preparacao: {
    label: "Em preparação",
    color: "bg-cyan-500/15 text-cyan-400 border-cyan-500/40",
    glow: "",
  },
  em_curso: {
    label: "Em curso",
    color: "bg-primary/20 text-primary border-primary/50",
    glow: "shadow-[0_0_16px_-2px_rgba(168,85,247,0.45)]",
  },
  em_liquidacao: {
    label: "Em liquidação",
    color: "bg-orange-500/15 text-orange-400 border-orange-500/40",
    glow: "shadow-[0_0_12px_-2px_rgba(251,146,60,0.35)]",
  },
  concluida: {
    label: "Concluída",
    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/40",
    glow: "shadow-[0_0_12px_-2px_rgba(52,211,153,0.35)]",
  },
  cancelada: {
    label: "Cancelada",
    color: "bg-destructive/15 text-destructive border-destructive/40",
    glow: "",
  },
};

const STATUS_ORDER = [
  "criada",
  "trancagem",
  "em_preparacao",
  "em_curso",
  "em_liquidacao",
  "concluida",
  "cancelada",
];

export function SaidaStatusBadge({
  status,
  pulse = false,
  className,
}: {
  status: string;
  pulse?: boolean;
  className?: string;
}) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.criada;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide",
        cfg.color,
        cfg.glow,
        pulse && status === "em_curso" && "animate-pulse-glow",
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          status === "em_curso" && "bg-primary animate-pulse",
          status === "criada" && "bg-amber-400",
          status === "trancagem" && "bg-slate-400",
          status === "em_preparacao" && "bg-cyan-400",
          status === "em_liquidacao" && "bg-orange-400",
          status === "concluida" && "bg-emerald-400",
          status === "cancelada" && "bg-destructive",
        )}
      />
      {cfg.label}
    </span>
  );
}

export function statusProgress(status: string): number {
  const idx = STATUS_ORDER.indexOf(status);
  if (idx < 0) return 0;
  return Math.min(100, Math.round((idx / (STATUS_ORDER.length - 1)) * 100));
}

export function statusStepIndex(status: string): number {
  return STATUS_ORDER.indexOf(status);
}
