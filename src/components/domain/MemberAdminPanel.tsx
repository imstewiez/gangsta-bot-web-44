import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { toast } from "sonner";
import { beautifyError } from "@/lib/messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  adminRenameMember,
  adminSetTier,
  adminKickMember,
  adminAdjustStats,
  adminAddDisciplinaryRecord,
  adminAddMemberNote,
  adminDeleteDisciplinaryRecord,
  adminDeleteMemberNote,
  adminEndMemberAbsence,
  adminSetMemberAbsence,
  listMemberAdminRecords,
  TIER_LIST,
} from "@/lib/member-admin.functions";
import { TIER_LABELS } from "@/lib/domain";
import { cn } from "@/lib/utils";
import {
  Pencil,
  Crown,
  UserMinus,
  UserCheck,
  Activity,
  Skull,
  Swords,
  TrendingUp,
  Package,
  Coins,
  ShoppingBag,
  X,
  Save,
  StickyNote,
  AlertTriangle,
  ShieldAlert,
  CalendarClock,
  Trash2,
} from "lucide-react";

type Member = {
  id: number;
  display_name: string | null;
  nick: string | null;
  tier: string | null;
  status_lifecycle?: string | null;
};

type Stats = {
  kills: number;
  deaths: number;
  saidas: number;
  deliveries: number;
  vendas: number;
  orders: number;
};

const STAT_META: {
  key: keyof Stats;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}[] = [
  {
    key: "kills",
    label: "Abates",
    icon: Swords,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10 border-emerald-400/20",
  },
  {
    key: "deaths",
    label: "Mortes",
    icon: Skull,
    color: "text-rose-400",
    bg: "bg-rose-400/10 border-rose-400/20",
  },
  {
    key: "saidas",
    label: "Saídas",
    icon: TrendingUp,
    color: "text-amber-400",
    bg: "bg-amber-400/10 border-amber-400/20",
  },
  {
    key: "deliveries",
    label: "Entregas",
    icon: Package,
    color: "text-sky-400",
    bg: "bg-sky-400/10 border-sky-400/20",
  },
  {
    key: "vendas",
    label: "Vendas",
    icon: Coins,
    color: "text-violet-400",
    bg: "bg-violet-400/10 border-violet-400/20",
  },
  {
    key: "orders",
    label: "Encomendas",
    icon: ShoppingBag,
    color: "text-orange-400",
    bg: "bg-orange-400/10 border-orange-400/20",
  },
];

export function MemberAdminPanel({
  member,
  stats,
  myTier,
  canManage,
}: {
  member: Member;
  stats: Stats;
  myTier: string | null;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const nav = useNavigate();

  const renameFn = useAuthedServerFn(adminRenameMember);
  const tierFn = useAuthedServerFn(adminSetTier);
  const kickFn = useAuthedServerFn(adminKickMember);
  const adjustFn = useAuthedServerFn(adminAdjustStats);
  const recordsFn = useAuthedServerFn(listMemberAdminRecords);
  const addNoteFn = useAuthedServerFn(adminAddMemberNote);
  const deleteNoteFn = useAuthedServerFn(adminDeleteMemberNote);
  const addDisciplineFn = useAuthedServerFn(adminAddDisciplinaryRecord);
  const deleteDisciplineFn = useAuthedServerFn(adminDeleteDisciplinaryRecord);
  const setAbsenceFn = useAuthedServerFn(adminSetMemberAbsence);
  const endAbsenceFn = useAuthedServerFn(adminEndMemberAbsence);

  const records = useQuery({
    queryKey: ["member-admin-records", member.id],
    queryFn: () => recordsFn({ data: { member_id: member.id } }),
    enabled: canManage,
  });

  const [name, setName] = useState(member.display_name ?? "");
  const [nick, setNick] = useState(member.nick ?? "");
  const [tier, setTier] = useState<string>(member.tier ?? "young_blood");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [editingStats, setEditingStats] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [disciplineKind, setDisciplineKind] = useState<"aviso" | "punicao">("aviso");
  const [disciplineTitle, setDisciplineTitle] = useState("");
  const [disciplineBody, setDisciplineBody] = useState("");
  const [disciplinePoints, setDisciplinePoints] = useState("0");
  const [disciplineExpiresAt, setDisciplineExpiresAt] = useState("");
  const [absenceReason, setAbsenceReason] = useState("");
  const [absenceEndsAt, setAbsenceEndsAt] = useState("");

  // Delta inputs (all start at "0")
  const [killsDelta, setKillsDelta] = useState("0");
  const [deathsDelta, setDeathsDelta] = useState("0");
  const [saidasDelta, setSaidasDelta] = useState("0");
  const [deliveriesDelta, setDeliveriesDelta] = useState("0");
  const [vendasDelta, setVendasDelta] = useState("0");
  const [ordersDelta, setOrdersDelta] = useState("0");

  async function run<T>(label: string, fn: () => Promise<T>, ok: string) {
    setBusy(label);
    try {
      await fn();
      toast.success(ok);
      await qc.invalidateQueries({ queryKey: ["member", String(member.id)] });
      await qc.invalidateQueries({ queryKey: ["members"] });
      await qc.invalidateQueries({ queryKey: ["member-admin-records", member.id] });
    } catch (e) {
      toast.error(beautifyError(e));
    } finally {
      setBusy(null);
    }
  }

  const hasAnyDelta =
    Number(killsDelta) !== 0 ||
    Number(deathsDelta) !== 0 ||
    Number(saidasDelta) !== 0 ||
    Number(deliveriesDelta) !== 0 ||
    Number(vendasDelta) !== 0 ||
    Number(ordersDelta) !== 0;

  function resetDeltas() {
    setKillsDelta("0");
    setDeathsDelta("0");
    setSaidasDelta("0");
    setDeliveriesDelta("0");
    setVendasDelta("0");
    setOrdersDelta("0");
    setReason("");
  }

  const activeAbsence = records.data?.active_absence ?? null;
  const isAbsent = member.status_lifecycle === "absent" || member.status_lifecycle === "ausente" || Boolean(activeAbsence);
  const notes = records.data?.notes ?? [];
  const disciplinary = records.data?.disciplinary ?? [];

  function dateInputToIso(value: string) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function fmtShortDate(value: string | null | undefined) {
    if (!value) return "sem data";
    return new Date(value).toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  function resetDisciplineForm() {
    setDisciplineKind("aviso");
    setDisciplineTitle("");
    setDisciplineBody("");
    setDisciplinePoints("0");
    setDisciplineExpiresAt("");
  }

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="text-display text-sm flex items-center gap-2">
          <Crown className="h-4 w-4 text-primary" /> Painel de Chefia
          {!canManage && (
            <span className="ml-auto text-[10px] text-muted-foreground">
              Só leitura — mesmo cargo ou superior
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Estado / Ausencia */}
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-display text-xs text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" /> Estado
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                isAbsent
                  ? "border-amber-500/35 bg-amber-500/10 text-amber-400"
                  : "border-emerald-500/35 bg-emerald-500/10 text-emerald-400",
              )}
            >
              {isAbsent ? "Ausente" : "Ativo"}
            </Badge>
          </div>
          {activeAbsence && (
            <div className="rounded-md border border-amber-500/25 bg-amber-500/5 p-3 text-xs">
              <div className="font-medium text-amber-300">
                Ausente desde {fmtShortDate(activeAbsence.starts_at)}
                {activeAbsence.ends_at ? ` ate ${fmtShortDate(activeAbsence.ends_at)}` : ""}
              </div>
              {activeAbsence.reason && <p className="mt-1 text-muted-foreground">{activeAbsence.reason}</p>}
            </div>
          )}
          <div className="grid gap-2 md:grid-cols-[1fr_180px_auto]">
            <Input
              placeholder="Motivo da ausencia"
              value={absenceReason}
              onChange={(e) => setAbsenceReason(e.target.value)}
              disabled={!canManage}
            />
            <Input
              type="datetime-local"
              value={absenceEndsAt}
              onChange={(e) => setAbsenceEndsAt(e.target.value)}
              disabled={!canManage}
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={!canManage || busy !== null}
              onClick={() =>
                run(
                  "absence",
                  () =>
                    setAbsenceFn({
                      data: {
                        member_id: member.id,
                        reason: absenceReason || undefined,
                        ends_at: dateInputToIso(absenceEndsAt),
                      },
                    }),
                  "Membro marcado como ausente",
                ).then(() => {
                  setAbsenceReason("");
                  setAbsenceEndsAt("");
                })
              }
            >
              Marcar ausente
            </Button>
          </div>
          {isAbsent && (
            <Button
              size="sm"
              variant="outline"
              disabled={!canManage || busy !== null}
              onClick={() =>
                run(
                  "absence-end",
                  () => endAbsenceFn({ data: { member_id: member.id } }),
                  "Membro voltou a ativo",
                )
              }
            >
              <UserCheck className="mr-1 h-3.5 w-3.5" />
              Voltar a ativo
            </Button>
          )}
        </section>

        {/* Renomear */}
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-display text-xs text-muted-foreground">
            <Pencil className="h-3.5 w-3.5" /> Renomear (sincroniza com Discord)
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div>
              <Label className="text-xs">Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Alcunha</Label>
              <Input value={nick} onChange={(e) => setNick(e.target.value)} />
            </div>
          </div>
          <Button
            size="sm"
            disabled={busy !== null || !name.trim()}
            onClick={() =>
              run(
                "rename",
                () =>
                  renameFn({
                    data: {
                      id: member.id,
                      display_name: name.trim(),
                      nickname: nick.trim() || null,
                    },
                  }),
                "Nome atualizado",
              )
            }
          >
            Guardar nome
          </Button>
        </section>

        {/* Promover/Despromover */}
        <section className="space-y-2 border-t border-border pt-4">
          <div className="flex items-center gap-2 text-display text-xs text-muted-foreground">
            <Crown className="h-3.5 w-3.5" /> Promover / Despromover
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className="h-9 rounded-sm border border-border bg-input px-2 text-sm"
              disabled={!canManage}
            >
              {TIER_LIST.map((t) => (
                <option key={t} value={t}>
                  {TIER_LABELS[t]}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              variant="secondary"
              disabled={!canManage || busy !== null || tier === member.tier}
              onClick={() =>
                run(
                  "tier",
                  () =>
                    tierFn({
                      data: {
                        id: member.id,
                        tier: tier,
                      },
                    }),
                  "Tier atualizado e enviado ao bot",
                )
              }
            >
              Aplicar
            </Button>
          </div>
          {!canManage && (
            <p className="text-[11px] text-muted-foreground">
              Não podes alterar o tier de alguém do mesmo cargo ou superior ao teu.
            </p>
          )}
        </section>

        {/* Estatísticas — Visual */}
        <section className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-display text-xs text-muted-foreground">
              <Activity className="h-3.5 w-3.5" /> Estatísticas
            </div>
            {canManage && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  if (editingStats) {
                    setEditingStats(false);
                    resetDeltas();
                  } else {
                    setEditingStats(true);
                  }
                }}
              >
                {editingStats ? (
                  <>
                    <X className="h-3 w-3" /> Cancelar
                  </>
                ) : (
                  <>
                    <Pencil className="h-3 w-3" /> Editar
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {STAT_META.map((s) => {
              const Icon = s.icon;
              const value = stats[s.key];
              const delta =
                s.key === "kills"
                  ? killsDelta
                  : s.key === "deaths"
                    ? deathsDelta
                    : s.key === "saidas"
                      ? saidasDelta
                      : s.key === "deliveries"
                        ? deliveriesDelta
                        : s.key === "vendas"
                          ? vendasDelta
                          : ordersDelta;
              const setDelta =
                s.key === "kills"
                  ? setKillsDelta
                  : s.key === "deaths"
                    ? setDeathsDelta
                    : s.key === "saidas"
                      ? setSaidasDelta
                      : s.key === "deliveries"
                        ? setDeliveriesDelta
                        : s.key === "vendas"
                          ? setVendasDelta
                          : setOrdersDelta;
              const deltaNum = Number(delta) || 0;
              const preview = value + deltaNum;
              const isPositive = deltaNum > 0;
              const isNegative = deltaNum < 0;

              return (
                <div
                  key={s.key}
                  className={cn(
                    "relative rounded-md border p-3 transition-colors",
                    s.bg,
                    editingStats && "ring-1 ring-primary/30",
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className={cn("h-3.5 w-3.5", s.color)} />
                    <span className={cn("text-[10px] font-medium uppercase tracking-wider", s.color)}>
                      {s.label}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold tabular-nums text-foreground">
                      {editingStats ? preview : value}
                    </span>
                    {editingStats && deltaNum !== 0 && (
                      <span
                        className={cn(
                          "text-xs font-semibold tabular-nums",
                          isPositive ? "text-emerald-400" : "text-rose-400",
                        )}
                      >
                        {isPositive ? "+" : ""}
                        {deltaNum}
                      </span>
                    )}
                  </div>
                  {editingStats && (
                    <div className="mt-2">
                      <Input
                        type="number"
                        value={delta}
                        onChange={(e) => setDelta(e.target.value)}
                        placeholder="+/-"
                        className="h-7 text-xs bg-background/60 border-border/60"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Edit mode controls */}
          {editingStats && (
            <div className="space-y-3 rounded-md border border-border/60 bg-muted/20 p-3">
              <div>
                <Label className="text-xs">Motivo</Label>
                <Input
                  placeholder="ex: corrigir bug"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy !== null || !hasAnyDelta}
                  onClick={() =>
                    run(
                      "adjust",
                      () =>
                        adjustFn({
                          data: {
                            id: member.id,
                            kills_delta: Number(killsDelta) || undefined,
                            deaths_delta: Number(deathsDelta) || undefined,
                            saidas_delta: Number(saidasDelta) || undefined,
                            deliveries_delta: Number(deliveriesDelta) || undefined,
                            sales_delta: Number(vendasDelta) || undefined,
                            orders_delta: Number(ordersDelta) || undefined,
                            reason: reason || undefined,
                          },
                        }),
                      "Estatísticas ajustadas",
                    ).then(() => {
                      setEditingStats(false);
                      resetDeltas();
                    })
                  }
                >
                  <Save className="mr-1 h-3 w-3" />
                  Aplicar ajuste
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingStats(false);
                    resetDeltas();
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Notas internas */}
        <section className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center gap-2 text-display text-xs text-muted-foreground">
            <StickyNote className="h-3.5 w-3.5" /> Notas internas
          </div>
          <div className="grid gap-2">
            <Textarea
              rows={2}
              placeholder="Adicionar nota interna..."
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              disabled={!canManage}
            />
            <Button
              size="sm"
              className="justify-self-start"
              disabled={!canManage || busy !== null || !noteBody.trim()}
              onClick={() =>
                run(
                  "note",
                  () => addNoteFn({ data: { member_id: member.id, body: noteBody.trim() } }),
                  "Nota adicionada",
                ).then(() => setNoteBody(""))
              }
            >
              Adicionar nota
            </Button>
          </div>
          <div className="space-y-2">
            {records.isLoading && <p className="text-xs text-muted-foreground">A carregar notas...</p>}
            {!records.isLoading && notes.length === 0 && <p className="text-xs text-muted-foreground">Sem notas internas.</p>}
            {notes.map((note) => (
              <div key={note.id} className="rounded-md border border-border/70 bg-muted/20 p-3">
                <div className="mb-1 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                  <span>{fmtShortDate(note.created_at)} {note.created_by_name ? `por ${note.created_by_name}` : ""}</span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={!canManage || busy !== null}
                    onClick={() => run("note-delete", () => deleteNoteFn({ data: { id: note.id } }), "Nota removida")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="whitespace-pre-wrap text-sm">{note.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Avisos e punicoes */}
        <section className="space-y-3 border-t border-border pt-4">
          <div className="flex items-center gap-2 text-display text-xs text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5" /> Avisos e punicoes
          </div>
          <div className="grid gap-2 md:grid-cols-[130px_1fr_110px_180px]">
            <select
              value={disciplineKind}
              onChange={(e) => setDisciplineKind(e.target.value as "aviso" | "punicao")}
              className="h-9 rounded-sm border border-border bg-input px-2 text-sm"
              disabled={!canManage}
            >
              <option value="aviso">Aviso</option>
              <option value="punicao">Punicao</option>
            </select>
            <Input
              placeholder="Titulo"
              value={disciplineTitle}
              onChange={(e) => setDisciplineTitle(e.target.value)}
              disabled={!canManage}
            />
            <Input
              type="number"
              placeholder="Pontos"
              value={disciplinePoints}
              onChange={(e) => setDisciplinePoints(e.target.value)}
              disabled={!canManage}
            />
            <Input
              type="datetime-local"
              value={disciplineExpiresAt}
              onChange={(e) => setDisciplineExpiresAt(e.target.value)}
              disabled={!canManage}
            />
          </div>
          <Textarea
            rows={2}
            placeholder="Descricao do aviso/punicao..."
            value={disciplineBody}
            onChange={(e) => setDisciplineBody(e.target.value)}
            disabled={!canManage}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={!canManage || busy !== null || !disciplineBody.trim()}
            onClick={() =>
              run(
                "discipline",
                () =>
                  addDisciplineFn({
                    data: {
                      member_id: member.id,
                      kind: disciplineKind,
                      title: disciplineTitle || undefined,
                      body: disciplineBody.trim(),
                      points: Number(disciplinePoints) || 0,
                      expires_at: dateInputToIso(disciplineExpiresAt),
                    },
                  }),
                disciplineKind === "aviso" ? "Aviso adicionado" : "Punicao adicionada",
              ).then(resetDisciplineForm)
            }
          >
            Adicionar registo
          </Button>
          <div className="space-y-2">
            {!records.isLoading && disciplinary.length === 0 && <p className="text-xs text-muted-foreground">Sem avisos ou punicoes.</p>}
            {disciplinary.map((record) => (
              <div key={record.id} className="rounded-md border border-border/70 bg-muted/20 p-3">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px]",
                        record.kind === "aviso"
                          ? "border-amber-500/35 bg-amber-500/10 text-amber-400"
                          : "border-destructive/35 bg-destructive/10 text-destructive",
                      )}
                    >
                      {record.kind === "aviso" ? "Aviso" : "Punicao"}
                    </Badge>
                    <span className="text-sm font-medium">{record.title || "Sem titulo"}</span>
                    {record.points !== 0 && <span className="text-xs text-muted-foreground">{record.points} pts</span>}
                  </div>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={!canManage || busy !== null}
                    onClick={() => run("discipline-delete", () => deleteDisciplineFn({ data: { id: record.id } }), "Registo removido")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="whitespace-pre-wrap text-sm">{record.body}</p>
                <div className="mt-2 text-[11px] text-muted-foreground">
                  {fmtShortDate(record.issued_at)}
                  {record.expires_at ? ` · expira ${fmtShortDate(record.expires_at)}` : ""}
                  {record.created_by_name ? ` · ${record.created_by_name}` : ""}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Kick */}
        <section className="space-y-2 border-t border-destructive/30 pt-4">
          <div className="flex items-center gap-2 text-display text-xs text-destructive">
            <UserMinus className="h-3.5 w-3.5" /> Expulsar do bairro
          </div>
          <p className="text-xs text-muted-foreground">
            Marca o membro como saído e dá kick no Discord automaticamente via
            bot.
          </p>
          <Button
            size="sm"
            variant="destructive"
            disabled={!canManage || busy !== null}
            onClick={() => {
              if (!confirm(`Confirmar expulsão de ${member.display_name}?`))
                return;
              run(
                "kick",
                () =>
                  kickFn({
                    data: { id: member.id, reason: reason || undefined },
                  }),
                "Membro expulso",
              ).then(() => nav({ to: "/membros" }));
            }}
          >
            Expulsar
          </Button>
          {!canManage && (
            <p className="text-[11px] text-muted-foreground">
              Não podes expulsar alguém do mesmo cargo ou superior ao teu.
            </p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

