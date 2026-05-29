import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Crosshair, Footprints, Calendar, FileText, CheckCircle2 } from "lucide-react";

const TYPE_OPTIONS = [
  {
    key: "ataque",
    label: "Saída",
    desc: "Máx. 12 participantes",
    icon: Crosshair,
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30 hover:border-red-500/60",
  },
  {
    key: "recolha",
    label: "Pista",
    desc: "Sem limite",
    icon: Footprints,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30 hover:border-blue-500/60",
  },
  {
    key: "craft",
    label: "Fabricação",
    desc: "Sessão de fabricação",
    icon: Crosshair,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30 hover:border-emerald-500/60",
  },
  {
    key: "dominio",
    label: "Domínio",
    desc: "Dominação de território",
    icon: Crosshair,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30 hover:border-amber-500/60",
  },
  {
    key: "defesa",
    label: "Defesa",
    desc: "Defesa do bairro",
    icon: Crosshair,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30 hover:border-purple-500/60",
  },
  {
    key: "outra",
    label: "Outra",
    desc: "Outro tipo",
    icon: Crosshair,
    color: "text-muted-foreground",
    bg: "bg-muted",
    border: "border-border hover:border-border/80",
  },
];

export type WizardData = {
  type: string;
  when: string;
  notes: string;
};

export function SaidaWizard({
  onSubmit,
  onCancel,
  isSubmitting,
}: {
  onSubmit: (data: WizardData) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const [step, setStep] = useState(0);
  const [type, setType] = useState("");
  const [when, setWhen] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });
  const [notes, setNotes] = useState("");

  const canSubmit = !!type;

  return (
    <div className="w-full max-w-md">
      {/* Step 0: Type */}
      {step === 0 && (
        <div className="space-y-4">
          <h3 className="text-display text-sm font-medium">Tipo de sessão</h3>
          <div className="grid grid-cols-2 gap-3">
            {TYPE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const active = type === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => setType(opt.key)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all",
                    active
                      ? cn(opt.bg, opt.border, "ring-1 ring-inset")
                      : "border-border/60 bg-card/40 hover:bg-card/80",
                  )}
                >
                  <Icon className={cn("h-6 w-6", active ? opt.color : "text-muted-foreground")} />
                  <div className={cn("text-sm font-medium", active ? opt.color : "text-foreground")}>
                    {opt.label}
                  </div>
                  <div className="text-[10px] text-muted-foreground/70">{opt.desc}</div>
                </button>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancelar
            </Button>
            <Button size="sm" disabled={!type} onClick={() => setStep(1)}>
              Continuar
            </Button>
          </div>
        </div>
      )}

      {/* Step 1: Details */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setStep(0)}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              ← Voltar
            </button>
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Data e hora
            </label>
            <Input
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="h-9 text-sm"
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <FileText className="h-3 w-3" />
              Notas (opcional)
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas opcionais"
              className="min-h-[80px] text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={!canSubmit || isSubmitting}
              onClick={() => onSubmit({ type, when, notes })}
            >
              {isSubmitting ? (
                ""
              ) : (
                <>
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                  Criar
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
