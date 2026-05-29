import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useState } from "react";
import { getSaidaDetail, liquidateSaida } from "@/lib/liquidation.functions";
import { getCurrentMember } from "@/lib/pricing.functions";
import {
  cancelOperation,
  kickParticipant,
  inviteMembers,
  acceptInvite,
  declineInvite,
  listRoles,
} from "@/lib/operations.functions";
import { listMembersWithStats } from "@/lib/members.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { fmtDate, fmtNum } from "@/lib/domain";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Reveal, Stagger } from "@/components/layout/Reveal";
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
  AlertTriangle,
  Trophy,
  ShieldAlert,
  Shield,
  UserMinus,
  UserPlus,
  X,
  Check,
  Search,
  Truck,
  Package,
} from "lucide-react";
import { getOperationTypes } from "@/lib/config.loader";

export const Route = createFileRoute("/_authenticated/operacoes/$id")({
  component: Page,
});

function getTypeConfig(): Record<string, { bg: string; text: string; border: string }> {
  const types = getOperationTypes();
  const config: Record<string, { bg: string; text: string; border: string }> = {};
  const colorMap: Record<string, string> = {
    yellow: "yellow-400",
    emerald: "emerald-400",
    blue: "blue-400",
    red: "red-400",
    orange: "orange-400",
    muted: "muted-foreground",
  };
  for (const [key, val] of Object.entries(types)) {
    const colorClass = val.color.replace("text-", "");
    const baseColor = colorClass.replace(/-\d+$/, "");
    const shade = colorClass.match(/-(\d+)$/)?.[1] ?? "500";
    config[key] = {
      bg: `bg-${baseColor}-${shade}/10`,
      text: val.color,
      border: `border-${baseColor}-${shade}/30`,
    };
  }
  // Fallback for any missing keys
  config.outro = config.outro ?? { bg: "bg-muted", text: "text-muted-foreground", border: "border-border" };
  return config;
}

function Page() {
  const { id } = useParams({ from: "/_authenticated/operacoes/$id" });
  const saidaId = Number(id);

  useRealtimeSync([{ table: "operations", queryKeys: [["saida", String(saidaId)], ["saidas"]] }]);

  const detailFn = useAuthedServerFn(getSaidaDetail);
  const meFn = useAuthedServerFn(getCurrentMember);
  const qc = useQueryClient();

  const [confirmLiq, setConfirmLiq] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [kickTarget, setKickTarget] = useState<{ member_id: number; name: string } | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

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
      toast.success(`Saída liquidada · Líquido ${r.net.toFixed(0)} €`);
      setConfirmLiq(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelM = useMutation({
    mutationFn: () => cancelOperation({ data: { id: saidaId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saida", saidaId] });
      qc.invalidateQueries({ queryKey: ["saidas"] });
      toast.success("Saída cancelada");
      setConfirmCancel(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const kickM = useMutation({
    mutationFn: (vars: { operation_id: number; member_id: number }) => kickParticipant({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saida", saidaId] });
      qc.invalidateQueries({ queryKey: ["saidas"] });
      toast.success("Membro removido");
      setKickTarget(null);
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
  const isManager = me.data?.is_manager ?? false;
  const isLeader = op.leader_id === me.data?.id;
  const canManage = isManager || isLeader;
  const canLiquidate =
    isManager && (op.status === "concluida" || op.status === "em_liquidacao");
  const isFinalized = op.status === "concluida" || op.status === "cancelada";
  const TYPE_CONFIG = getTypeConfig();
  const typeStyle = getTypeConfig((op.operation_type ?? "outro").toLowerCase());

  const activeParticipants = participants.filter((p) => p.participant_type !== "pending");
  const pendingParticipants = participants.filter((p) => p.participant_type === "pending");
  const totalKills = activeParticipants.reduce((s, p) => s + p.kills, 0);
  const totalDeaths = activeParticipants.reduce((s, p) => s + p.deaths_count, 0);
  const myParticipant = participants.find((p) => p.member_id === me.data?.id);
  const isPending = myParticipant?.participant_type === "pending";

  return (
    <div className="animate-rise">
      <Reveal direction="up">
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
                {isFinalized && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                      op.was_profitable === true && "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
                      op.was_profitable === false && "border-red-500/30 bg-red-500/10 text-red-400",
                      op.was_profitable === null && "border-border bg-muted text-muted-foreground",
                    )}
                  >
                    {op.was_profitable === true ? (
                      <><Trophy className="h-3 w-3" /> Vitória</>
                    ) : op.was_profitable === false ? (
                      <><ShieldAlert className="h-3 w-3" /> Derrota</>
                    ) : (
                      <><Shield className="h-3 w-3" /> Sem resultado</>
                    )}
                  </span>
                )}
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
                  {activeParticipants.length} participante{activeParticipants.length !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1.5">
                  <Swords className="h-3.5 w-3.5" />
                  {totalKills}K / {totalDeaths}D
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isPending && (
                <>
                  <Button size="sm" variant="outline" onClick={() => declineInvite({ data: { operation_id: saidaId } }).then(() => { qc.invalidateQueries({ queryKey: ["saida", saidaId] }); toast.success("Convite recusado"); })}>
                    <X className="mr-1 h-4 w-4" /> Recusar
                  </Button>
                  <Button size="sm" onClick={() => acceptInvite({ data: { operation_id: saidaId } }).then(() => { qc.invalidateQueries({ queryKey: ["saida", saidaId] }); toast.success("Convite aceite"); })}>
                    <Check className="mr-1 h-4 w-4" /> Aceitar
                  </Button>
                </>
              )}
              {canManage && !isFinalized && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setInviteOpen(true)}>
                    <UserPlus className="mr-1 h-4 w-4" /> Convidar
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setConfirmCancel(true)}>
                    Cancelar
                  </Button>
                </>
              )}
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
        </div>
      </div>
      </Reveal>

      <Reveal direction="up" delay={100}>
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
                Equipa ({activeParticipants.length})
              </TabsTrigger>
              <TabsTrigger value="resultado" className="gap-1.5 interactive-tab">
                <Skull className="h-3.5 w-3.5" />
                Resultado
              </TabsTrigger>
            </TabsList>

            <TabsContent value="equipa" className="mt-4 space-y-4">
              {/* Pending invites */}
              {pendingParticipants.length > 0 && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
                    Pendentes ({pendingParticipants.length})
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {pendingParticipants.map((p) => (
                      <ParticipantRow
                        key={p.id}
                        p={p}
                        canKick={canManage}
                        onKick={() => setKickTarget({ member_id: p.member_id, name: p.member_name ?? `M#${p.member_id}` })}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Active participants */}
              <div className="grid gap-3 sm:grid-cols-2">
                {activeParticipants.map((p) => (
                  <ParticipantRow
                    key={p.id}
                    p={p}
                    canKick={canManage && !isFinalized}
                    onKick={() => setKickTarget({ member_id: p.member_id, name: p.member_name ?? `M#${p.member_id}` })}
                  />
                ))}
                {activeParticipants.length === 0 && (
                  <div className="col-span-full rounded-xl border border-dashed border-border/50 bg-card/30 py-10 text-center">
                    <Users className="mx-auto h-8 w-8 text-muted-foreground/30" />
                    <p className="mt-2 text-sm text-muted-foreground">Sem participantes registados</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="resultado" className="mt-4">
              <ResultTab
                operation={op}
                participants={activeParticipants}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      </Reveal>

      {/* Liquidation confirmation dialog */}
      <Dialog open={confirmLiq} onOpenChange={setConfirmLiq}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Liquidar
            </DialogTitle>
            <DialogDescription>
              Vais finalizar a saída #{saidaId} e calcular o líquido para todos os participantes.
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
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

      {/* Cancel confirmation dialog */}
      <Dialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Cancelar saída
            </DialogTitle>
            <DialogDescription>
              Tens a certeza que queres cancelar a saída #{saidaId}? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
              Deixa lá
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelM.mutate()}
              disabled={cancelM.isPending}
            >
              {cancelM.isPending ? "A processar" : "Cancelar saída"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Kick confirmation dialog */}
      <Dialog open={!!kickTarget} onOpenChange={() => setKickTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserMinus className="h-5 w-5 text-destructive" />
              Remover membro
            </DialogTitle>
            <DialogDescription>
              Tens a certeza que queres remover {kickTarget?.name} da saída?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setKickTarget(null)}>
              Deixa lá
            </Button>
            <Button
              variant="destructive"
              onClick={() => kickTarget && kickM.mutate({ operation_id: saidaId, member_id: kickTarget.member_id })}
              disabled={kickM.isPending}
            >
              {kickM.isPending ? "A processar" : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invite dialog */}
      {inviteOpen && (
        <InviteDialog
          operationId={saidaId}
          onClose={() => setInviteOpen(false)}
        />
      )}
    </div>
  );
}

function ParticipantRow({
  p,
  canKick,
  onKick,
}: {
  p: {
    id: number;
    member_id: number;
    member_name: string | null;
    role_in_op: string | null;
    kills: number;
    deaths_count: number;
    survived: boolean;
    died: boolean;
    settled: boolean;
    participant_type: string;
  };
  canKick?: boolean;
  onKick?: () => void;
}) {
  const kd = p.deaths_count === 0 ? p.kills : (p.kills / p.deaths_count).toFixed(2);
  const isPending = p.participant_type === "pending";

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3 transition-all hover:bg-card/80",
        p.settled ? "border-emerald-500/20 bg-emerald-500/5" : "border-border/60 bg-card/40",
        isPending && "border-amber-500/20 bg-amber-500/5",
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
          {isPending && (
            <span className="rounded bg-amber-500/10 px-1.5 py-0 text-[10px] text-amber-400">
              Pendente
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Swords className="h-3 w-3" />
            {p.kills}K/{p.deaths_count}D
          </span>
          {p.died && (
            <span className="flex items-center gap-1 text-red-400">
              <Skull className="h-3 w-3" /> Morreu
            </span>
          )}
          {p.survived && !p.died && (
            <span className="flex items-center gap-1 text-emerald-400">
              <Shield className="h-3 w-3" /> Sobreviveu
            </span>
          )}
        </div>
      </div>
      {canKick && onKick && (
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={(e) => { e.stopPropagation(); onKick(); }}>
          <UserMinus className="h-4 w-4" />
        </Button>
      )}
      {p.settled ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
      ) : (
        <div className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
      )}
    </div>
  );
}

function ResultTab({
  operation,
  participants,
}: {
  operation: {
    was_profitable: boolean | null;
    enemy_name: string | null;
    enemy_faction: string | null;
    had_fight: boolean | null;
    survivors: number | null;
    deaths: number | null;
    our_kills: number | null;
  };
  participants: Array<{
    member_name: string | null;
    member_id: number;
    kills: number;
    deaths_count: number;
    survived: boolean;
    died: boolean;
  }>;
}) {
  const totalKills = participants.reduce((s, p) => s + p.kills, 0);
  const totalDeaths = participants.reduce((s, p) => s + p.deaths_count, 0);
  const kd = totalDeaths === 0 ? totalKills : (totalKills / totalDeaths).toFixed(2);

  return (
    <div className="space-y-4">
      {/* Result card */}
      <div className="grid grid-cols-2 gap-3">
        <div className={cn(
          "rounded-xl border p-4 text-center",
          operation.was_profitable === true && "border-emerald-500/30 bg-emerald-500/5",
          operation.was_profitable === false && "border-red-500/30 bg-red-500/5",
          operation.was_profitable === null && "border-border bg-card/40",
        )}>
          {operation.was_profitable === true ? (
            <Trophy className="mx-auto h-6 w-6 text-emerald-400" />
          ) : operation.was_profitable === false ? (
            <ShieldAlert className="mx-auto h-6 w-6 text-red-400" />
          ) : (
            <Shield className="mx-auto h-6 w-6 text-muted-foreground" />
          )}
          <div className={cn(
            "mt-1 text-xl font-bold font-display",
            operation.was_profitable === true && "text-emerald-400",
            operation.was_profitable === false && "text-red-400",
            operation.was_profitable === null && "text-muted-foreground",
          )}>
            {operation.was_profitable === true ? "Vitória" : operation.was_profitable === false ? "Derrota" : "Sem resultado"}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card/40 p-4 text-center">
          <Swords className="mx-auto h-6 w-6 text-primary" />
          <div className="mt-1 text-xl font-bold font-display">
            {operation.had_fight === true ? "Houve confronto" : operation.had_fight === false ? "Sem confronto" : "—"}
          </div>
        </div>
      </div>

      {operation.enemy_name && (
        <div className="rounded-xl border border-border/60 bg-card/40 p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1">Inimigo</div>
          <div className="text-lg font-bold">
            {operation.enemy_name}
            {operation.enemy_faction && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">({operation.enemy_faction})</span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <ResultStat label="Abates Totais" value={fmtNum(operation.our_kills ?? totalKills)} icon={Skull} color="text-red-400" />
        <ResultStat label="Mortes" value={fmtNum(operation.deaths ?? totalDeaths)} icon={Users} color="text-destructive" />
        <ResultStat label="Sobreviventes" value={fmtNum(operation.survivors ?? participants.filter((p) => p.survived).length)} icon={Shield} color="text-emerald-400" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <ResultStat label="Rácio R/A" value={String(kd)} icon={Swords} color="text-primary" />
      </div>

      {/* Kill distribution */}
      {participants.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card/40 p-4">
          <h4 className="mb-3 text-sm font-semibold">Desempenho individual</h4>
          <div className="space-y-2">
            {participants
              .sort((a, b) => b.kills - a.kills)
              .map((p, i) => {
                const maxKills = Math.max(...participants.map((pp) => pp.kills), 1);
                const pct = (p.kills / maxKills) * 100;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-24 truncate text-xs text-muted-foreground">
                      {p.member_name ?? `M#${p.member_id}`}
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
                    <div className="flex items-center gap-2">
                      <span className="w-8 text-right text-xs font-medium">{p.kills}K</span>
                      {p.died && <Skull className="h-3 w-3 text-red-400" />}
                      {p.survived && !p.died && <Shield className="h-3 w-3 text-emerald-400" />}
                    </div>
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

function InviteDialog({ operationId, onClose }: { operationId: number; onClose: () => void }) {
  const [tab, setTab] = useState<"members" | "tags">("members");
  const [selectedMembers, setSelectedMembers] = useState<Set<number>>(new Set());
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const qc = useQueryClient();

  const membersFn = useAuthedServerFn(listMembersWithStats);
  const rolesFn = useAuthedServerFn(listRoles);
  const inviteFn = useAuthedServerFn(inviteMembers);

  const membersQ = useQuery({
    queryKey: ["members-all-stats"],
    queryFn: () => membersFn(),
  });

  const rolesQ = useQuery({
    queryKey: ["roles"],
    queryFn: () => rolesFn(),
  });

  const inviteM = useMutation({
    mutationFn: (vars: { operation_id: number; member_ids?: number[]; role?: string }) =>
      inviteFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["saida", String(operationId)] });
      toast.success("Convites enviados");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const allMembers = (membersQ.data ?? []) as Array<{
    id: number; display_name: string | null; nick: string | null;
    role_label: string | null; tier: string | null;
    kills: number; deaths: number; saidas: number; deliveries: number; sales: number;
  }>;
  const roles = (rolesQ.data ?? []) as Array<{ role: string; count: number }>;

  const filtered = allMembers.filter((m) => {
    const q = search.toLowerCase();
    return (
      (m.display_name ?? "").toLowerCase().includes(q) ||
      (m.nick ?? "").toLowerCase().includes(q) ||
      (m.role_label ?? "").toLowerCase().includes(q) ||
      (m.tier ?? "").toLowerCase().includes(q)
    );
  });

  const tierLabel = (tier: string | null) => {
    const map: Record<string, string> = {
      young_blood: "YB", o_gunao: "OG", gangster_fodido: "GF",
      patrao_di_zona: "PDZ", real_gangster: "RG", og: "OG",
      kingpin: "KP", manda_chuva: "MC",
    };
    return map[tier ?? ""] ?? tier ?? "—";
  };

  const tierColor = (tier: string | null) => {
    const map: Record<string, string> = {
      young_blood: "text-blue-400", o_gunao: "text-emerald-400", gangster_fodido: "text-orange-400",
      patrao_di_zona: "text-purple-400", real_gangster: "text-red-400", og: "text-yellow-400",
      kingpin: "text-rose-400", manda_chuva: "text-amber-400",
    };
    return map[tier ?? ""] ?? "text-muted-foreground";
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Convidar membros
          </DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="w-full">
            <TabsTrigger value="members">Individuais</TabsTrigger>
            <TabsTrigger value="tags">Por Tag</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="mt-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Procurar por nome, cargo ou tier..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="max-h-[320px] overflow-y-auto space-y-1">
              {filtered.map((m) => (
                <label
                  key={m.id}
                  className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/30 px-3 py-2 cursor-pointer hover:bg-card/60"
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.has(m.id)}
                    onChange={(e) => {
                      const next = new Set(selectedMembers);
                      if (e.target.checked) next.add(m.id);
                      else next.delete(m.id);
                      setSelectedMembers(next);
                    }}
                    className="h-4 w-4 rounded border-border shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{m.display_name ?? m.nick ?? `M#${m.id}`}</span>
                      <span className={cn("text-[10px] font-bold uppercase", tierColor(m.tier))}>{tierLabel(m.tier)}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground/70 mt-0.5">
                      <span className="flex items-center gap-0.5"><Skull className="h-3 w-3" /> {m.kills}</span>
                      <span className="flex items-center gap-0.5"><Crosshair className="h-3 w-3" /> {m.saidas}</span>
                      <span className="flex items-center gap-0.5"><Truck className="h-3 w-3" /> {m.deliveries}</span>
                      <span className="flex items-center gap-0.5"><Package className="h-3 w-3" /> {m.sales}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground capitalize shrink-0">{m.role_label}</span>
                </label>
              ))}
              {filtered.length === 0 && (
                <div className="text-center text-xs text-muted-foreground py-4">Nenhum membro encontrado.</div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="tags" className="mt-3">
            <div className="space-y-1">
              {roles.map((r) => (
                <label
                  key={r.role}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors",
                    selectedRole === r.role
                      ? "border-primary bg-primary/10"
                      : "border-border/40 bg-card/30 hover:bg-card/60",
                  )}
                  onClick={() => setSelectedRole(r.role)}
                >
                  <span className="text-sm font-medium">{r.role}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">{r.count} membro{r.count !== 1 ? "s" : ""}</span>
                </label>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Deixa lá</Button>
          <Button
            disabled={
              inviteM.isPending ||
              (tab === "members" && selectedMembers.size === 0) ||
              (tab === "tags" && !selectedRole)
            }
            onClick={() =>
              inviteM.mutate({
                operation_id: operationId,
                member_ids: tab === "members" ? Array.from(selectedMembers) : undefined,
                role: tab === "tags" ? (selectedRole ?? undefined) : undefined,
              })
            }
          >
            {inviteM.isPending ? "A enviar" : "Enviar convites"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
