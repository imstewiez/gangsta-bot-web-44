import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useState } from "react";
import {
  listPrizes,
  setPrize,
  type PrizeType,
} from "@/lib/prizes.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { fmtDate, fmtNum } from "@/lib/domain";
import { toast } from "sonner";
import { Trophy, Gift, Check, Home, Car, Sword, Banknote, Package } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Reveal } from "@/components/layout/Reveal";
import { cn } from "@/lib/utils";
import { getPrizeTypes } from "@/lib/config.loader";

const PRIZE_TYPE_ICONS: Record<string, React.ReactNode> = {
  Casa: <Home className="h-4 w-4" />,
  Arma: <Sword className="h-4 w-4" />,
  Carro: <Car className="h-4 w-4" />,
  Dinheiro: <Banknote className="h-4 w-4" />,
  Outro: <Package className="h-4 w-4" />,
};

const STATUS_LABELS: Record<string, string> = {
  por_definir: "Por definir",
  definido: "Definido",
  entregue: "Entregue",
};

const STATUS_COLORS: Record<string, string> = {
  por_definir: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  definido: "bg-primary/10 text-primary border-primary/20",
  entregue: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
};

export const Route = createFileRoute("/_authenticated/premios")({
  component: Page,
});

function Page() {
  useRealtimeSync(["prizes"]);
  const fn = useAuthedServerFn(listPrizes);
  const setFn = useAuthedServerFn(setPrize);
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const prizes = useQuery({ queryKey: ["prizes"], queryFn: () => fn() });
  const [editId, setEditId] = useState<number | null>(null);
  const [prizeType, setPrizeType] = useState<string>("");
  const [desc, setDesc] = useState("");
  const [status, setStatus] = useState("por_definir");
  const [notes, setNotes] = useState("");

  const m = useMutation({
    mutationFn: () =>
      setFn({
        data: {
          id: editId!,
          prize_type: prizeType || null,
          description: desc,
          status,
          notes,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prizes"] });
      toast.success("Prémio atualizado");
      setEditId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const latest = prizes.data?.[0];
  const needsDefinition = latest?.prize_status === "por_definir";

  const prizeTypes = getPrizeTypes();
  const prizeTypeOptions = prizeTypes.map((type) => ({
    value: type as PrizeType,
    label: type,
    icon: PRIZE_TYPE_ICONS[type] ?? <Package className="h-4 w-4" />,
  }));

  return (
    <>
      <PageHeader
        eyebrow="Ranking"
        title="Prémios semanais"
        description="Vencedor calculado automaticamente · Chefia define o prémio"
      />

      {/* Prémio atual em destaque */}
      {latest && (
        <Reveal direction="up">
          <div className={cn(
            "mb-6 rounded-sm border p-5",
            needsDefinition
              ? "border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-transparent"
              : "border-primary/20 bg-gradient-to-br from-primary/5 to-transparent"
          )}>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider mb-3">
              <Trophy className="h-4 w-4 text-primary" />
              Prémio da semana {fmtDate(latest.week_start)} → {fmtDate(latest.week_end)}
            </div>
            <div className="flex items-center gap-4">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/15 ring-2 ring-primary/30 shrink-0 text-2xl">
                🏆
              </span>
              <div className="flex-1">
                <div className="text-lg font-bold">
                  {latest.winner_name ?? "—"}
                </div>
                <div className="text-sm text-muted-foreground">
                  Pontos: {fmtNum(Math.round(latest.hybrid_score ?? 0))}
                </div>
                {latest.prize_type && (
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-primary font-medium">
                    <Gift className="h-3.5 w-3.5" />
                    {latest.prize_type}
                    {latest.prize_description && (
                      <span className="text-muted-foreground font-normal">
                        — {latest.prize_description}
                      </span>
                    )}
                  </div>
                )}
                {!latest.prize_type && needsDefinition && (
                  <div className="mt-1 text-xs text-amber-400">
                    ⚠ A chefia ainda não definiu o prémio
                  </div>
                )}
              </div>
              <span className={cn(
                "rounded-sm border px-2.5 py-1 text-xs font-medium",
                STATUS_COLORS[latest.prize_status] ?? "bg-muted text-muted-foreground"
              )}>
                {STATUS_LABELS[latest.prize_status] ?? latest.prize_status}
              </span>
              {isAdmin && (
                <Button
                  size="sm"
                  variant={needsDefinition ? "default" : "outline"}
                  onClick={() => {
                    setEditId(latest.id);
                    setPrizeType(latest.prize_type ?? "");
                    setDesc(latest.prize_description ?? "");
                    setStatus(latest.prize_status);
                    setNotes(latest.notes ?? "");
                  }}
                >
                  {needsDefinition ? "Definir prémio" : "Editar"}
                </Button>
              )}
            </div>
          </div>
        </Reveal>
      )}

      {/* Histórico */}
      <Reveal direction="up" delay={150}>
        <div className="space-y-2">
          <div className="text-display text-xs tracking-[0.2em] text-muted-foreground uppercase mb-2">
            Histórico de prémios
          </div>
          {prizes.isLoading && (
            <p className="text-muted-foreground">A carregar</p>
          )}
          {(prizes.data ?? []).slice(1).map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-4 rounded-sm border border-border bg-card p-3 interactive-row"
            >
              <Trophy className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">
                  {p.winner_name ?? "—"}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {fmtDate(p.week_start)} → {fmtDate(p.week_end)}
                  {p.hybrid_score != null && (
                    <span> · {fmtNum(Math.round(p.hybrid_score))} pontos</span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                {p.prize_type ? (
                  <div className="text-sm font-medium">{p.prize_type}</div>
                ) : (
                  <div className="text-xs text-muted-foreground">Por definir</div>
                )}
                {p.prize_description && (
                  <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                    {p.prize_description}
                  </div>
                )}
              </div>
              <span className={cn(
                "rounded-sm border px-2 py-0.5 text-[10px] font-medium shrink-0",
                STATUS_COLORS[p.prize_status] ?? "bg-muted text-muted-foreground"
              )}>
                {STATUS_LABELS[p.prize_status] ?? p.prize_status}
              </span>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    setEditId(p.id);
                    setPrizeType(p.prize_type ?? "");
                    setDesc(p.prize_description ?? "");
                    setStatus(p.prize_status);
                    setNotes(p.notes ?? "");
                  }}
                >
                  Editar
                </Button>
              )}
            </div>
          ))}
          {!prizes.isLoading && (prizes.data ?? []).length <= 1 && (
            <p className="text-muted-foreground text-sm">Sem histórico de prémios.</p>
          )}
        </div>
      </Reveal>

      {/* Dialog de edição */}
      <Dialog open={editId != null} onOpenChange={(v) => !v && setEditId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {prizeType ? "Editar prémio" : "Definir prémio"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <label className="text-xs text-muted-foreground font-medium">
                Tipo de prémio
              </label>
              <div className="grid grid-cols-5 gap-2 mt-1.5">
                {prizeTypeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPrizeType(opt.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-sm border p-2 text-xs transition-colors",
                      prizeType === opt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-primary/30"
                    )}
                  >
                    {opt.icon}
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">
                Descrição (ex: "Casa no Grove", "50.000€", "AK-47 full mod")
              </label>
              <Input
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="O que vai ser dado ao vencedor..."
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["por_definir", "definido", "entregue"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-medium">Notas</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas internas..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditId(null)}>
              Cancelar
            </Button>
            <Button onClick={() => m.mutate()} disabled={m.isPending}>
              {m.isPending ? "A guardar..." : <><Check className="mr-1 h-3.5 w-3.5" /> Guardar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
