import { cn } from "@/lib/utils";
import {
  FilePlus,
  Crosshair,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  type LucideIcon,
} from "lucide-react";

const STEPS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "criada", label: "Criada", icon: FilePlus },
  { key: "em_curso", label: "Em curso", icon: Crosshair },
  { key: "em_liquidacao", label: "Liquidação", icon: ClipboardCheck },
  { key: "concluida", label: "Concluída", icon: CheckCircle2 },
];

const STATUS_TO_STEP: Record<string, string> = {
  criada: "criada",
  trancagem: "criada",
  em_preparacao: "criada",
  em_curso: "em_curso",
  em_liquidacao: "em_liquidacao",
  concluida: "concluida",
  cancelada: "cancelada",
};

export function SaidaTimeline({ status }: { status: string }) {
  const currentStep = STATUS_TO_STEP[status] ?? "criada";
  const currentIdx = STEPS.findIndex((s) => s.key === currentStep);
  const isCancelled = status === "cancelada";

  return (
    <div className="relative">
      {/* Connecting line */}
      <div className="absolute left-4 top-4 h-[calc(100%-2rem)] w-px bg-border/60" />

      <div className="space-y-1">
        {STEPS.map((step, idx) => {
          const isActive = idx <= currentIdx && !isCancelled;
          const isCurrent = idx === currentIdx && !isCancelled;
          const Icon = step.icon;

          return (
            <div
              key={step.key}
              className={cn(
                "relative flex items-center gap-3 py-2 transition-all duration-500",
                isActive ? "opacity-100" : "opacity-40",
              )}
            >
              {/* Step circle */}
              <div
                className={cn(
                  "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300",
                  isCurrent
                    ? "border-primary bg-primary/20 shadow-[0_0_12px_-2px_rgba(168,85,247,0.4)]"
                    : isActive
                      ? "border-emerald-500/60 bg-emerald-500/10"
                      : "border-border bg-card",
                )}
              >
                <Icon
                  className={cn(
                    "h-3.5 w-3.5",
                    isCurrent ? "text-primary" : isActive ? "text-emerald-400" : "text-muted-foreground",
                  )}
                />
              </div>

              {/* Label */}
              <div className="flex flex-col">
                <span
                  className={cn(
                    "text-xs font-medium",
                    isCurrent ? "text-primary" : isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
                {isCurrent && (
                  <span className="text-[10px] text-muted-foreground/60">
                    Estado atual
                  </span>
                )}
              </div>

              {/* Checkmark for completed */}
              {isActive && !isCurrent && (
                <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-500/60" />
              )}
            </div>
          );
        })}

        {isCancelled && (
          <div className="relative flex items-center gap-3 py-2">
            <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-destructive bg-destructive/10">
              <XCircle className="h-3.5 w-3.5 text-destructive" />
            </div>
            <span className="text-xs font-medium text-destructive">Cancelada</span>
          </div>
        )}
      </div>
    </div>
  );
}
