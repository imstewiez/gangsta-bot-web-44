import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useState } from "react";
import { getSaidaDetail, liquidateSaida } from "@/lib/liquidation.functions";
import { getCurrentMember } from "@/lib/pricing.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { SaidaStatusBadge } from "@/components/operations/SaidaStatusBadge";
import { SaidaTimeline } from "@/components/operations/SaidaTimeline";
import { fmtDate, fmtNum, fmtPrice } from "@/lib/domain";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Crosshair,
  MapPin,
  Calendar,
  Users,
  Skull,
  Swords,
  CheckCircle2,
  FileText,
  Package,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  User,
  Shield,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/operacoes/$id")({
  component: Page,
});

const TYPE_CONFIG: Record<string, { bg: string; text: string; border: string }> = {
  bagueta: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30" },
  monte: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/30" },
  labs: { bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/30" },
  guetto: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/30" },
  treino: { bg: "bg-blue-500/10", text: "text-blue-400", border: "border-blue-500/30" },
  outro: { bg: "bg-muted", text: "text-muted-foreground", border: "border-border" },
};

function Page() {
  const { id } = useParams({ from: "/_authenticated/operacoes/$id" });
  const saidaId = Number(id);

  useRealtimeSync([{ table: "operations", queryKeys: [["saida", String(saidaId)], ["saidas"]] }]);

  const detailFn = useAuthedServerFn(getSaidaDetail);
  const meFn = useAuthedServerFn(getCurrentMember);
  const qc = useQueryClient();

  const [confirmLiq, setConfirmLiq] = useState(false);

  const detail = useQuery({
    queryKey: ["saida", saidaId],
    queryFn: () => detailFn({ data: { id: saidaId } }),
  });

  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => meFn(),
    staleTime: 60_000,
  });

  const liq = useMutation({
    mutationFn: () => liquidateSaida({ data: { id: saidaId } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["saida", saidaId] });
      qc.invalidateQueries({ queryKey: ["saidas"] });
      toast.success(`Saída liquidada · Net ${fmtPrice(r.net)}`);
      setConfirmLiq(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (detail.isLoading) {
    return (
      <div className="space-y-6 animate-rise">
        <div className="h-32 animate-pulse rounded-xl bg-card/40" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-64 animate-pulse rounded-xl bg-card/40" />
          <div className="lg:col-span-2 h-64 animate-pulse rounded-xl bg-card/40" />
        </div>
      </div>
    );
  }

  if (!detail.data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-rise">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <Crosshair className="h-8 w-8 text-muted-foreground/40" />
        </div>
        <h2 className="text-lg font-bold">Saída não encontrada</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A saída #{saidaId} não existe ou foi removida.
        </p>
        <Button className="mt-5" asChild>
          <Link to="/operacoes">← Voltar às saídas</Link>
        </Button>
      </div>
    );
  }

  const op = detail.data.operation;
  const participants = detail.data.participants;
  const materials = detail.data.materials;
  const isManager = me.data?.is_manager ?? false;
  const canLiquidate =
    isManager &&
    (op.status === "concluida" || op.status === "em_liquidacao");
  const isFinalized = op.status === "concluida" || op.status === "cancelada";
  const typeStyle = TYPE_CONFIG[(op.operation_type ?? "outro").toLowerCase()] ?? TYPE_CONFIG.outro;

  const totalKills = participants.reduce((s, p) => s + p.kills, 0);
  const totalDeaths = participants.reduce((s, p) => s + p.deaths_count, 0);
  const settledCount = participants.filter((p) => p.settled).length;

  return (
    <div className="animate-rise">
      {/* Back link */}
      <Link
        to="/operacoes"
        className="mb-4 inline-flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar às saídas
      </Link>

      {/* Hero header */}
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border p-6 backdrop-blur-sm",
          "bg-card/60",
          typeStyle.border,
          op.status === "em_curso" && "shadow-[0_0_30px_-10px_rgba(168,85,247,0.2)]",
        )}
      >
        {/* Background glow */}
        <div
          className={cn(
            "absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl opacity-20",
            typeStyle.bg.replace("/10", ""),
          )}
        />

        <div className="relative">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                    typeStyle.bg,
                    typeStyle.text,
                    typeStyle.border,
                  )}
                >
                  <Crosshair className="h-3 w-3" />
                  {op.operation_type ?? "Outro"}
                </span>
                <SaidaStatusBadge status={op.status} pulse={op.status === "em_curso"} />
              </div>
              <h1 className="text-3xl font-bold font-display">
                {op.spot ?? "Spot por definir"}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {op.scheduled_at ? fmtDate(op.scheduled_at) : "Data por definir"}
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {participants.length} participantes
                </span>
                <span className="flex items-center gap-1.5">
                  <Swords className="h-3.5 w-3.5" />
                  {totalKills}K / {totalDeaths}D
                </span>
                {isFinalized && settledCount === participants.length && (
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Liquidada
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {canLiquidate && (
                <Button
                  onClick={() => setConfirmLiq(true)}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Liquidar
                </Button>
              )}
            </div>
          </div>

          {/* Quick stats grid */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <QuickStat
              label="Fornecido"
              value={fmtPrice(op.supplied_value)}
              icon={Package}
              accent="warning"
            />
            <QuickStat
              label="Retornado"
              value={fmtPrice(op.returned_value)}
              icon={TrendingUp}
              accent="success"
            />
            <QuickStat
              label="Perdido"
              value={fmtPrice(op.lost_value)}
              icon={TrendingDown}
              accent="destructive"
            />
            <QuickStat
              label="Net"
              value={fmtPrice(op.net_value)}
              icon={op.net_value >= 0 ? TrendingUp : TrendingDown}
              accent={op.net_value >= 0 ? "success" : "destructive"}
            />
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Left: Timeline */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm">
            <h3 className="mb-4 text-sm font-semibold font-display">Progresso</h3>
            <SaidaTimeline status={op.status} />
          </div>

          {op.notes && (
            <div className="mt-4 rounded-xl border border-border/60 bg-card/40 p-4 backdrop-blur-sm">
              <h3 className="mb-2 text-sm font-semibold font-display flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                Notas
              </h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{op.notes}</p>
            </div>
          )}
        </div>

        {/* Right: Tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="equipa">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="equipa" className="gap-1.5 interactive-tab">
                <Users className="h-3.5 w-3.5" />
                Equipa ({participants.length})
              </TabsTrigger>
              <TabsTrigger value="materiais" className="gap-1.5 interactive-tab">
                <Package className="h-3.5 w-3.5" />
                Materiais ({materials.length})
              </TabsTrigger>
              <TabsTrigger value="resultado" className="gap-1.5 interactive-tab">
                <Skull className="h-3.5 w-3.5" />
                Resultado
              </TabsTrigger>
            </TabsList>

            <TabsContent value="equipa" className="mt-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {participants.map((p) => (
                  <ParticipantRow key={p.id} p={p} />
                ))}
                {participants.length === 0 && (
                  <div className="col-span-full rounded-xl border border-dashed border-border/50 bg-card/30 py-10 text-center">
                    <Users className="mx-auto h-8 w-8 text-muted-foreground/30" />
                    <p className="mt-2 text-sm text-muted-foreground">Sem participantes registados</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="materiais" className="mt-4">
              <div className="space-y-2">
                {materials.map((m) => (
                  <MaterialRow key={m.id} m={m} />
                ))}
                {materials.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border/50 bg-card/30 py-10 text-center">
                    <Package className="mx-auto h-8 w-8 text-muted-foreground/30" />
                    <p className="mt-2 text-sm text-muted-foreground">Sem materiais registados</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="resultado" className="mt-4">
              <ResultTab participants={participants} />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Liquidation confirmation dialog */}
      <Dialog open={confirmLiq} onOpenChange={setConfirmLiq}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Liquidar
            </DialogTitle>
            <DialogDescription>
              Vais finalizar a saída #{saidaId} e calcular o net para todos os participantes.
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fornecido</span>
              <span>{fmtPrice(op.supplied_value)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Retornado</span>
              <span className="text-emerald-400">{fmtPrice(op.returned_value)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Perdido</span>
              <span className="text-destructive">{fmtPrice(op.lost_value)}</span>
            </div>
            <div className="hairline-top pt-2 flex justify-between font-semibold">
              <span>Net estimado</span>
              <span className={op.net_value >= 0 ? "text-emerald-400" : "text-destructive"}>
                {fmtPrice(op.net_value)}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmLiq(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => liq.mutate()}
              disabled={liq.isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {liq.isPending ? "A processar" : "Liquidar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuickStat({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: "warning" | "success" | "destructive" | "muted";
}) {
  const colors = {
    warning: "text-amber-400",
    success: "text-emerald-400",
    destructive: "text-destructive",
    muted: "text-muted-foreground",
  };
  return (
    <div className="rounded-lg bg-muted/30 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/60">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={cn("mt-0.5 text-sm font-bold font-mono", colors[accent])}>{value}</div>
    </div>
  );
}

function ParticipantRow({
  p,
}: {
  p: {
    id: number;
    member_id: number;
    member_name: string | null;
    role_in_op: string | null;
    kills: number;
    deaths_count: number;
    net_material_delta: number;
    settled: boolean;
  };
}) {
  const kd = p.deaths_count === 0 ? p.kills : (p.kills / p.deaths_count).toFixed(2);
  const positive = p.net_material_delta >= 0;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3 transition-all hover:bg-card/80",
        p.settled ? "border-emerald-500/20 bg-emerald-500/5" : "border-border/60 bg-card/40",
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
        {(p.member_name ?? "?")
          .split(" ")
          .map((w) => w[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{p.member_name ?? `Membro #${p.member_id}`}</span>
          {p.role_in_op && (
            <span className="rounded bg-muted px-1.5 py-0 text-[10px] text-muted-foreground">
              {p.role_in_op}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Skull className="h-3 w-3" />
            {p.kills}K/{p.deaths_count}D
          </span>
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            <span className={positive ? "text-emerald-400" : "text-destructive"}>
              {fmtPrice(p.net_material_delta)}
            </span>
          </span>
        </div>
      </div>
      {p.settled ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
      ) : (
        <div className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
      )}
    </div>
  );
}

function MaterialRow({
  m,
}: {
  m: {
    id: number;
    item_id: number;
    item_name: string | null;
    direction: string;
    quantity: number;
  };
}) {
  const isOut = m.direction === "out" || m.direction === "issued";
  const isLost = m.direction === "lost";

  return (
    <div className="flex items-center justify-between rounded-lg border border-border/40 bg-card/30 px-3 py-2">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md",
            isOut && "bg-amber-500/10 text-amber-400",
            isLost && "bg-destructive/10 text-destructive",
            !isOut && !isLost && "bg-emerald-500/10 text-emerald-400",
          )}
        >
          <Package className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm">{m.item_name ?? `Item #${m.item_id}`}</span>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "text-[10px] uppercase tracking-wider font-medium",
            isOut && "text-amber-400",
            isLost && "text-destructive",
            !isOut && !isLost && "text-emerald-400",
          )}
        >
          {m.direction}
        </span>
        <span className="text-sm font-mono font-medium">×{fmtNum(m.quantity)}</span>
      </div>
    </div>
  );
}

function ResultTab({
  participants,
}: {
  participants: Array<{
    kills: number;
    deaths_count: number;
  }>;
}) {
  const totalKills = participants.reduce((s, p) => s + p.kills, 0);
  const totalDeaths = participants.reduce((s, p) => s + p.deaths_count, 0);
  const kd = totalDeaths === 0 ? totalKills : (totalKills / totalDeaths).toFixed(2);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <ResultStat label="Kills Totais" value={fmtNum(totalKills)} icon={Skull} color="text-red-400" />
        <ResultStat
          label="Mortes"
          value={fmtNum(totalDeaths)}
          icon={Users}
          color="text-destructive"
        />
        <ResultStat label="K/D Ratio" value={String(kd)} icon={Swords} color="text-primary" />
      </div>

      {/* Kill distribution */}
      {participants.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card/40 p-4">
          <h4 className="mb-3 text-sm font-semibold">Distribuição de Kills</h4>
          <div className="space-y-2">
            {participants
              .sort((a, b) => b.kills - a.kills)
              .map((p, i) => {
                const maxKills = Math.max(...participants.map((pp) => pp.kills), 1);
                const pct = (p.kills / maxKills) * 100;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-24 truncate text-xs text-muted-foreground">
                      {(p as any).member_name ?? `M#${(p as any).member_id}`}
                    </div>
                    <div className="flex-1">
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            i === 0 ? "bg-primary" : "bg-primary/40",
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-8 text-right text-xs font-medium">{p.kills}</div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

function ResultStat({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4 text-center">
      <Icon className={cn("mx-auto h-5 w-5", color)} />
      <div className={cn("mt-1 text-2xl font-bold font-display", color)}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">{label}</div>
    </div>
  );
}
