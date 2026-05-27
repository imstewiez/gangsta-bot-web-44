import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { useState, useMemo } from "react";
import {
  listOrders,
  createOrder,
  transitionOrder,
  cancelOwnOrder,
  listOrderComments,
  addOrderComment,
} from "@/lib/orders.functions";
import { computeCraftFeasibilityBatch } from "@/lib/recipes.functions";
import { getCatalog, getCurrentMember } from "@/lib/pricing.functions";
import { listManagers } from "@/lib/members.functions";
import { type CatalogItem } from "@/lib/pricing.shared";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { ButtonLoading } from "@/components/ui/ButtonLoading";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { fmtDate, fmtNum , fmtPrice, fmtCategoryLabel} from "@/lib/domain";
import {
  ARMORY_CAT_ORDER,
  ARMORY_CAT_CONFIG,
  filterItemForDisplay,
} from "@/lib/armory.catalog";
import { toast } from "sonner";
import { Plus, ShoppingBag, Trash2, Package, Banknote, X, MessageSquare, Send } from "lucide-react";
import { PageSkeleton, TableSkeleton, CardGridSkeleton } from "@/components/layout/PageSkeleton";
import { EmptyState } from "@/components/layout/EmptyState";
import { Loader2 } from "lucide-react";
import { PageErrorBoundary } from "@/components/layout/PageErrorBoundary";
import { FadeIn } from "@/components/layout/FadeIn";
import { Reveal, Stagger } from "@/components/layout/Reveal";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/encomendas")({
  errorComponent: PageErrorBoundary,
  head: () => ({
    meta: [{ title: "Encomendas | Ballas Gang" }],
  }),
  component: Page,
});

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  approved: "Aprovada",
  in_progress: "Em processamento",
  ready: "Pronta",
  fulfilled: "Entregue",
  denied: "Recusada",
  cancelled: "Cancelada",
};

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-muted text-muted-foreground border-border",
  approved: "bg-warning/20 text-warning border-warning/40",
  in_progress: "bg-info/20 text-info border-info/40",
  ready: "bg-info/30 text-info border-info/50",
  fulfilled: "bg-success/20 text-success border-success/40",
  denied: "bg-destructive/20 text-destructive border-destructive/40",
  cancelled: "bg-muted/60 text-muted-foreground border-border line-through",
};

const NEXT_STATES: Record<
  string,
  { to: string; label: string; variant?: "destructive" | "default" }[]
> = {
  pending: [
    { to: "approved", label: "Aceitar" },
    { to: "denied", label: "Recusar", variant: "destructive" },
  ],
  approved: [
    { to: "in_progress", label: "Pôr a tratar" },
    { to: "cancelled", label: "Cancelar", variant: "destructive" },
  ],
  in_progress: [{ to: "ready", label: "Marcar pronta" }],
  ready: [{ to: "fulfilled", label: "Entregue" }],
};

const ACTIVE_STATUSES = ["pending", "approved", "in_progress", "ready"];
const ARCHIVED_STATUSES = ["fulfilled", "denied", "cancelled"];

function Page() {
  useRealtimeSync([
    { table: "orders", queryKeys: [["orders"], ["stock"], ["my-xp"]] },
    { table: "order_comments", queryKeys: [["order_comments"]] },
  ]);
  const meFn = useAuthedServerFn(getCurrentMember);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const isManager = me.data?.is_manager ?? false;
  const [tab, setTab] = useState<string>("mine");
  const [mineSub, setMineSub] = useState<string>("active");
  const [manageSub, setManageSub] = useState<string>("active");

  return (
    <>
      <PageHeader
        eyebrow="Operação"
        title="Encomendas"
        description="Pedidos e encomendas"
        icon={ShoppingBag}
        action={<NewOrder />}
      />
      <FadeIn>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="mine" className="interactive-tab">As minhas</TabsTrigger>
            {isManager && <TabsTrigger value="manage" className="interactive-tab">Para tratar</TabsTrigger>}
          </TabsList>
          <TabsContent value="mine" className="mt-4">
            <Tabs value={mineSub} onValueChange={setMineSub}>
              <TabsList className="mb-3">
                <TabsTrigger value="active" className="interactive-tab">A decorrer</TabsTrigger>
                <TabsTrigger value="archived" className="interactive-tab">Histórico</TabsTrigger>
              </TabsList>
              <TabsContent value="active">
                <Reveal direction="up" delay={0}>
                  <OrdersList scope="mine" canManage={false} meId={me.data?.id} statusFilter="active" />
                </Reveal>
              </TabsContent>
              <TabsContent value="archived">
                <Reveal direction="up" delay={100}>
                  <OrdersList scope="mine" canManage={false} meId={me.data?.id} statusFilter="archived" />
                </Reveal>
              </TabsContent>
            </Tabs>
          </TabsContent>
          {isManager && (
            <TabsContent value="manage" className="mt-4">
              <Tabs value={manageSub} onValueChange={setManageSub}>
                <TabsList className="mb-3">
                  <TabsTrigger value="active" className="interactive-tab">A decorrer</TabsTrigger>
                  <TabsTrigger value="archived" className="interactive-tab">Arquivo de Encomendas</TabsTrigger>
                </TabsList>
                <TabsContent value="active">
                  <Reveal direction="up" delay={200}>
                    <OrdersList scope="manage" canManage meId={me.data?.id} statusFilter="active" />
                  </Reveal>
                </TabsContent>
                <TabsContent value="archived">
                  <Reveal direction="up" delay={300}>
                    <OrdersList scope="manage" canManage meId={me.data?.id} statusFilter="archived" />
                  </Reveal>
                </TabsContent>
              </Tabs>
            </TabsContent>
          )}
        </Tabs>
      </FadeIn>
    </>
  );
}

function OrdersList({
  scope,
  canManage,
  meId,
  statusFilter,
}: {
  scope: "mine" | "manage";
  canManage: boolean;
  meId?: number;
  statusFilter: "active" | "archived";
}) {
  const fn = useAuthedServerFn(listOrders);
  const transFn = useAuthedServerFn(transitionOrder);
  const cancelFn = useAuthedServerFn(cancelOwnOrder);
  const commentsFn = useAuthedServerFn(listOrderComments);
  const addCommentFn = useAuthedServerFn(addOrderComment);
  const qc = useQueryClient();
  const statuses = statusFilter === "active" ? ACTIVE_STATUSES : ARCHIVED_STATUSES;
  const orders = useQuery({
    queryKey: ["orders", scope, statusFilter],
    queryFn: () => fn({ data: { scope, statuses } }),
  });
  const m = useMutation({
    mutationFn: (v: { id: number; to: string }) =>
      transFn({
        data: v as {
          id: number;
          to:
            | "pending"
            | "approved"
            | "in_progress"
            | "ready"
            | "fulfilled"
            | "denied"
            | "cancelled";
        },
      }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["orders"] });
      const prev = qc.getQueryData(["orders", scope, statusFilter]);
      qc.setQueryData(["orders", scope, statusFilter], (old: any) =>
        old?.map((o: any) =>
          o.id === vars.id ? { ...o, status: vars.to } : o
        )
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["orders", scope, statusFilter], ctx.prev);
      toast.error(_e.message);
    },
    onSuccess: (res) => {
      if (res && "ok" in res && res.ok === false) {
        toast.error(res.error);
        return;
      }
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      toast.success("Guardado");
    },
  });

  const cancelM = useMutation({
    mutationFn: (id: number) => cancelFn({ data: { id } }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ["orders"] });
      const prev = qc.getQueryData(["orders", scope, statusFilter]);
      qc.setQueryData(["orders", scope, statusFilter], (old: any) =>
        old?.map((o: any) =>
          o.id === id ? { ...o, status: "cancelled" } : o
        )
      );
      return { prev };
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(["orders", scope, statusFilter], ctx.prev);
      toast.error(_e.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Encomenda cancelada");
    },
  });

  // Agrupar por batch_id (fallback para id único se não tiver batch)
  const batches = useMemo(() => {
    if (!orders.data) return [];
    const map = new Map<string, typeof orders.data>();
    for (const o of orders.data) {
      const key = o.batch_id ?? `single-${o.id}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    }
    return Array.from(map.entries()).sort((a, b) => {
      const ta = a[1][0]?.created_at ?? "";
      const tb = b[1][0]?.created_at ?? "";
      return tb.localeCompare(ta);
    });
  }, [orders.data]);

  if (orders.isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  if (!orders.data?.length)
    return (
      <Card className="p-10 text-center interactive-card">
        <ShoppingBag className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
        <p className="text-display text-sm text-muted-foreground">
          {statusFilter === "active"
            ? "Nenhuma encomenda em aberto"
            : scope === "mine"
              ? "Nenhum pedido no histórico"
              : "Nenhuma encomenda arquivada"}
        </p>
      </Card>
    );

  return (
    <div className="grid gap-3">
      {batches.map(([batchId, lines]) => {
        const first = lines[0];
        const next = canManage ? NEXT_STATES[first.status] : null;
        const minId = Math.min(...lines.map((l) => l.id));
        const totalBatch = lines.reduce((s, l) => s + (l.total_price ?? 0), 0);
        const totalDirtyMoney = lines.reduce((s, l) => s + (l.dirty_money ?? 0), 0);
        const isOwn = meId != null && first.member_id === meId;
        const canCancel = isOwn && statusFilter === "active" && ["pending", "approved"].includes(first.status);

        // Agregar materiais de todas as linhas
        const agg = new Map<string, number>();
        for (const l of lines) {
          for (const ing of l.ingredients_json ?? []) {
            agg.set(ing.name, (agg.get(ing.name) ?? 0) + ing.needed);
          }
        }
        const aggregatedIngredients = Array.from(agg.entries()).map(([name, needed]) => ({ name, needed }));

        const handleTransition = async (to: string) => {
          await Promise.all(lines.map((l) => m.mutateAsync({ id: l.id, to })));
        };
        const handleCancel = async () => {
          if (!confirm("Tens a certeza que queres cancelar esta encomenda?")) return;
          await Promise.all(lines.map((l) => cancelM.mutateAsync(l.id)));
        };

        return (
          <Card key={batchId} className={cn("p-4 interactive-card", first.payment_mode === "money_only" && "border-amber-500/30 bg-amber-500/[0.02]")}>
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2">
                  <span className="text-display text-xs text-muted-foreground">
                    #{minId}
                  </span>
                  <span
                    className={
                      "rounded-sm border px-2 py-0.5 text-display text-[10px] uppercase tracking-wider " +
                      (STATUS_COLOR[first.status] ?? "")
                    }
                  >
                    {STATUS_LABEL[first.status] ?? first.status}
                  </span>
                  {first.payment_mode === "money_only" ? (
                    <span className="inline-flex items-center gap-1 rounded-sm border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                      <Banknote className="h-3 w-3" /> Sem materiais
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-sm border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
                      <Package className="h-3 w-3" /> Com materiais
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {fmtDate(first.created_at)}
                  </span>
                </div>

                {/* Lista de itens do batch */}
                <div className="mt-2 space-y-1">
                  {lines.map((l) => (
                    <div key={l.id} className="flex justify-between items-center text-sm interactive-row">
                      <span className="font-semibold">{l.quantity}× {l.item_name ?? "—"}</span>
                      <span className="text-muted-foreground font-mono text-xs">{l.total_price != null ? fmtPrice(l.total_price) : "—"}</span>
                    </div>
                  ))}
                </div>

                <div className="text-sm text-muted-foreground mt-1.5">
                  Para{" "}
                  <span className="text-foreground">
                    {first.member_name ?? "—"}
                  </span>
                  {first.responsavel_name && (
                    <span className="block mt-0.5">
                      Responsável:{" "}
                      <span className="text-foreground font-medium">{first.responsavel_name}</span>
                    </span>
                  )}
                  {first.notes && (
                    <span className="block mt-1 italic">"{first.notes}"</span>
                  )}
                </div>

                {/* Materiais agregados + dirty money */}
                <div className={`mt-2 rounded-sm border p-2 text-xs space-y-1.5 ${first.payment_mode === "money_only" ? "border-amber-500/20 bg-amber-500/5" : "border-border bg-muted/30"}`}>
                  {first.payment_mode === "money_only" ? (
                    <div className="flex items-center gap-1.5 text-amber-400">
                      <Banknote className="h-3.5 w-3.5" />
                      <span className="font-semibold">Pagamento integral em dinheiro</span>
                      <span className="text-muted-foreground">— sem materiais a entregar</span>
                    </div>
                  ) : (
                    <>
                      {aggregatedIngredients.length > 0 && (
                        <>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Materiais a entregar</div>
                          <ul className="space-y-0.5">
                            {aggregatedIngredients.map((ing, idx) => (
                              <li key={idx} className="flex justify-between items-center interactive-row">
                                <span className="text-foreground">{ing.name}</span>
                                <span className="text-muted-foreground font-mono">{fmtNum(ing.needed)}</span>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                      {totalDirtyMoney > 0 && (
                        <div className="border-t border-border pt-1.5 flex justify-between items-center font-semibold">
                          <span className="text-emerald-400">Dinheiro sujo:</span>
                          <span className="text-emerald-400 font-mono">{fmtPrice(Math.round(totalDirtyMoney))}</span>
                        </div>
                      )}
                      {aggregatedIngredients.length === 0 && totalDirtyMoney === 0 && (
                        <div className="text-muted-foreground">Não requer materiais</div>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-lg font-semibold">
                  {fmtPrice(totalBatch)}
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {lines.length} artigo{lines.length !== 1 ? "s" : ""}
                </div>
              </div>
              {(next || canCancel) && (
                <div className="flex w-full justify-end gap-1.5 border-t border-border pt-3">
                  {canCancel && (
                    <ButtonLoading
                      size="sm"
                      variant="outline"
                      loading={cancelM.isPending}
                      onClick={handleCancel}
                      className="text-destructive hover:text-destructive"
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      Cancelar
                    </ButtonLoading>
                  )}
                  {next?.map((s) => (
                    <ButtonLoading
                      key={s.to}
                      size="sm"
                      variant={
                        s.variant === "destructive" ? "outline" : "default"
                      }
                      loading={m.isPending}
                      onClick={() => handleTransition(s.to)}
                    >
                      {s.label}
                    </ButtonLoading>
                  ))}
                </div>
              )}
            </div>
            <OrderCommentThread orderId={minId} canComment={isOwn || canManage} />
          </Card>
        );
      })}
    </div>
  );
}

function OrderCommentThread({ orderId, canComment }: { orderId: number; canComment: boolean }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const commentsFn = useAuthedServerFn(listOrderComments);
  const addCommentFn = useAuthedServerFn(addOrderComment);
  const qc = useQueryClient();
  const comments = useQuery({
    queryKey: ["order_comments", orderId],
    queryFn: () => commentsFn({ data: { order_id: orderId } }),
    enabled: open,
  });
  const addM = useMutation({
    mutationFn: (content: string) => addCommentFn({ data: { order_id: orderId, content } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order_comments", orderId] });
      setText("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="border-t border-border mt-3 pt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {comments.data?.length ? `${comments.data.length} comentário${comments.data.length !== 1 ? "s" : ""}` : "Comentários"}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {comments.isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {comments.error && <p className="text-destructive text-xs">{(comments.error as Error).message}</p>}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {(comments.data ?? []).map((c) => (
              <div key={c.id} className="rounded-sm bg-muted/40 p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-xs">{c.author_name ?? "—"}</span>
                  <span className="text-[10px] text-muted-foreground">{fmtDate(c.created_at)}</span>
                </div>
                <p className="mt-0.5 text-sm text-foreground">{c.content}</p>
              </div>
            ))}
            {!comments.isLoading && !(comments.data ?? []).length && (
              <p className="text-xs text-muted-foreground">Sem comentários ainda.</p>
            )}
          </div>
          {canComment && (
            <div className="flex gap-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Escrever comentário..."
                className="h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && text.trim()) {
                    e.preventDefault();
                    addM.mutate(text.trim());
                  }
                }}
              />
              <ButtonLoading
                size="sm"
                loading={addM.isPending}
                disabled={!text.trim()}
                onClick={() => addM.mutate(text.trim())}
                className="h-8 px-2"
              >
                <Send className="h-3.5 w-3.5" />
              </ButtonLoading>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NewOrder() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select" | "checkout">("select");
  const catFn = useAuthedServerFn(getCatalog);
  const createFn = useAuthedServerFn(createOrder);
  const simFn = useAuthedServerFn(computeCraftFeasibilityBatch);
  const qc = useQueryClient();
  const cat = useQuery({
    queryKey: ["catalog"],
    queryFn: () => catFn(),
    enabled: open,
  });
  const items = (cat.data ?? []).filter((i: CatalogItem) => {
    const n = i.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Armas Orange (whitelist rigorosa)
    if (
      /\bmini smg\b/.test(n) ||
      /\bxm3\b/.test(n) || /\bpistol xm3\b/.test(n) || /\bmachine pistol\b/.test(n) ||
      /\bmicro smg\b/.test(n) ||
      /\btec[-\s]?9\b/.test(n) || /\btec9\b/.test(n) ||
      /\btec[-\s]?pistol\b/.test(n) || /\btecpistol\b/.test(n) ||
      /\bap[-\s]?pistol\b/.test(n) || /\bappistol\b/.test(n) ||
      /\bcompact rifle\b/.test(n)
    ) {
      // Rejeitar MK2 e Assault Shotgun
      if (/mk2|assault shotgun/.test(n)) return false;
      return true;
    }

    // Armas Red (whitelist rigorosa)
    if (
      /\bheavy[-\s]?pistol\b/.test(n) || /\bheavypistol\b/.test(n) ||
      /\b\.50\b/.test(n) || /\bpistol[-\s]?\.50\b/.test(n) || /\bpistol50\b/.test(n) ||
      /\bp90\b/.test(n) ||
      /\bpdw\b/.test(n) || /\bcombat[-\s]?pdw\b/.test(n) ||
      /\bbullpup\b/.test(n) || /\bbullpup[-\s]?rifle\b/.test(n) ||
      /\bcarabina\b/.test(n) || /\bcarabina[-\s]?rifle\b/.test(n)
    ) {
      if (/mk2/.test(n)) return false;
      return true;
    }

    // Carregadores
    if (/\bcarregador\b/.test(n) || /\bmagazine\b/.test(n)) {
      if (/mk2/.test(n)) return false;
      if (/orange/.test(n) || /red/.test(n) || /especial/.test(n) || /special/.test(n)) return true;
      return false;
    }

    // Prints
    if (/\bprint\b/.test(n) || /\bblueprint\b/.test(n) || /\besquema\b/.test(n)) {
      if (/laranja|orange/.test(n) || /azul|blue/.test(n) || /vermelh|red/.test(n) || /amarel|yellow|dourad/.test(n)) return true;
      return false;
    }

    // Corpos
    if (/\bcorpo\b/.test(n) || /\bchassi\b/.test(n)) {
      if (/mk2/.test(n)) return false;
      if (/mini[-\s]?smg|micro[-\s]?smg|xm3|pistol[-\s]?xm3|tec[-\s]?9|tec9|tec[-\s]?pistol|tecpistol|ap[-\s]?pistol|appistol/.test(n)) return true;
      return false;
    }

    // Extras: apenas Colete Padrão e attachments básicos
    if (/\bcolete[-\s]?padrao\b/.test(n) || /\bcolete[-\s]?padrao\b/.test(n.replace(/padrao/, "padrão"))) return true;
    if (/\bmira\b/.test(n) || /\bsilenciador\b/.test(n) || /\bscope\b/.test(n) || /\bgrip\b/.test(n) || /\bbarrel\b/.test(n) || /\bmuzzle\b/.test(n) || /\bextensivo\b/.test(n) || /\bmag[-\s]?expandido\b/.test(n)) return true;

    return false;
  });
  const [lines, setLines] = useState<{ item_id: string; qty: string }[]>([
    { item_id: "", qty: "1" },
  ]);
  const [notes, setNotes] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [paymentMode, setPaymentMode] = useState<"materials_money" | "money_only">("materials_money");
  const managersFn = useAuthedServerFn(listManagers);
  const managers = useQuery({
    queryKey: ["managers"],
    queryFn: () => managersFn(),
    enabled: open,
  });

  const validLines = lines.filter((l) => l.item_id && Number(l.qty) > 0);
  const sim = useQuery({
    queryKey: ["order-sim-batch", validLines.map((l) => `${l.item_id}:${l.qty}`).join(",")],
    queryFn: () =>
      simFn({
        data: {
          lines: validLines.map((l) => ({
            item_id: Number(l.item_id),
            quantity: Number(l.qty),
          })),
        },
      }),
    enabled: open && validLines.length > 0,
  });

  const m = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          lines: validLines.map((l) => ({
            item_id: Number(l.item_id),
            quantity: Number(l.qty),
          })),
          notes: notes || null,
          responsavel_member_id: responsavel ? Number(responsavel) : null,
          payment_mode: paymentMode,
        },
      }),
    onSuccess: () => {
      toast.success("Encomenda registada");
      qc.invalidateQueries({ queryKey: ["orders"] });
      setOpen(false);
      setStep("select");
      setLines([{ item_id: "", qty: "1" }]);
      setNotes("");
      setResponsavel("");
      setPaymentMode("materials_money");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Erro ao registar encomenda");
    },
  });

  const groups = new Map<string, typeof items>();
  for (const i of items) {
    const cat = filterItemForDisplay(i.name, i.category, i.subcategory);
    if (!cat) continue;
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(i);
  }
  const options: { value: string; label: string; group: string; groupColor?: string }[] = [];
  for (const cat of ARMORY_CAT_ORDER) {
    const list = groups.get(cat);
    if (!list) continue;
    const cfg = ARMORY_CAT_CONFIG[cat as keyof typeof ARMORY_CAT_CONFIG];
    options.push(
      ...list.map((i) => ({
        value: String(i.id),
        label: i.name,
        group: cfg?.label ?? fmtCategoryLabel(cat),
        groupColor: cfg?.headerColor,
      })),
    );
  }

  const selectedManager = (managers.data ?? []).find((m) => String(m.id) === responsavel);

  const handleClose = () => {
    setOpen(false);
    setStep("select");
    setLines([{ item_id: "", qty: "1" }]);
    setNotes("");
    setResponsavel("");
    setPaymentMode("materials_money");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); setOpen(v); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" />
          Encomendar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {step === "select" ? "O que precisas?" : "Confirma a tua encomenda"}
          </DialogTitle>
        </DialogHeader>

        {step === "select" ? (
          <>
            <div className="grid gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {lines.map((l, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_100px_auto] gap-2">
                  <SearchableSelect
                    value={l.item_id}
                    onChange={(v) =>
                      setLines(lines.map((x, i) => (i === idx ? { ...x, item_id: v } : x)))
                    }
                    options={options}
                    placeholder="Item"
                    searchPlaceholder="Procurar item..."
                    emptyText="Nenhum item encontrado."
                  />
                  <Input
                    type="number"
                    min={1}
                    value={l.qty}
                    onChange={(e) =>
                      setLines(lines.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x)))
                    }
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                    disabled={lines.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLines([...lines, { item_id: "", qty: "1" }])}
              >
                <Plus className="mr-1 h-4 w-4" />
                Mais uma linha
              </Button>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Modo de encomenda
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMode("materials_money")}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      paymentMode === "materials_money"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-muted/30 hover:bg-muted/50"
                    }`}
                  >
                    <Package className={`mb-1.5 h-5 w-5 ${paymentMode === "materials_money" ? "text-primary" : "text-muted-foreground"}`} />
                    <div className={`text-xs font-semibold ${paymentMode === "materials_money" ? "text-primary" : "text-foreground"}`}>
                      Com materiais
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                      Entrego materiais + dinheiro sujo
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMode("money_only")}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      paymentMode === "money_only"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-muted/30 hover:bg-muted/50"
                    }`}
                  >
                    <Banknote className={`mb-1.5 h-5 w-5 ${paymentMode === "money_only" ? "text-primary" : "text-muted-foreground"}`} />
                    <div className={`text-xs font-semibold ${paymentMode === "money_only" ? "text-primary" : "text-foreground"}`}>
                      Sem materiais
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                      Pago tudo em dinheiro
                    </div>
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  Responsável
                </label>
                <Select value={responsavel} onValueChange={setResponsavel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleciona quem gere isto" />
                  </SelectTrigger>
                  <SelectContent>
                    {(managers.data ?? []).map((mgr) => (
                      <SelectItem key={mgr.id} value={String(mgr.id)}>
                        {mgr.display_name ?? mgr.nick ?? `Membro #${mgr.id}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">
                  Notas (opcional)
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Notas"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={handleClose}>
                Deixa lá
              </Button>
              <Button
                disabled={validLines.length === 0 || !responsavel || sim.isLoading}
                onClick={() => setStep("checkout")}
              >
                Rever encomenda →
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="grid gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {/* Modo de pagamento */}
              <div className={`rounded-sm border p-2 text-xs flex items-center gap-2 ${paymentMode === 'money_only' ? 'border-amber-500/30 bg-amber-500/10 text-amber-400' : 'border-blue-500/30 bg-blue-500/10 text-blue-400'}`}>
                {paymentMode === 'money_only' ? <Banknote className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5" />}
                <span className="font-medium">{paymentMode === 'money_only' ? 'Só dinheiro (sem materiais)' : 'Materiais + dinheiro sujo'}</span>
              </div>

              {/* Items */}
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Items</div>
                <ul className="space-y-0.5 text-sm">
                  {validLines.map((l, idx) => {
                    const item = items.find((i) => String(i.id) === l.item_id);
                    return (
                      <li key={idx} className="flex justify-between items-center interactive-row">
                        <span className="font-medium">{l.qty}× {item?.name ?? "—"}</span>
                        {item != null && (
                          <span className="text-muted-foreground font-mono text-xs">{fmtPrice((item.tier_price ?? item.min_sale_price ?? 0) * Number(l.qty))}</span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Total */}
              <div className="rounded-sm border border-border bg-muted/30 p-3">
                <div className="flex justify-between items-center font-semibold text-sm">
                  <span>Total a pagar:</span>
                  <span className="font-mono">{fmtPrice((() => {
                    const baseTotal = validLines.reduce((s, l) => {
                      const item = items.find((i) => String(i.id) === l.item_id);
                      return s + (item?.tier_price ?? item?.min_sale_price ?? 0) * Number(l.qty);
                    }, 0);
                    if (paymentMode === 'money_only') {
                      return Math.round(baseTotal + (sim.data?.full_material_cost ?? 0) + baseTotal * 0.20);
                    }
                    return baseTotal;
                  })())}</span>
                </div>
                {paymentMode === 'money_only' && sim.data && (
                  <div className="text-[10px] text-muted-foreground mt-1 space-y-0.5">
                    <div className="flex justify-between"><span>Base:</span><span className="font-mono">{fmtPrice(Math.round(sim.data.dirty_money))}</span></div>
                    <div className="flex justify-between"><span>Material:</span><span className="font-mono">{fmtPrice(Math.round(sim.data.full_material_cost))}</span></div>
                    <div className="flex justify-between"><span>Taxa (20%):</span><span className="font-mono">{fmtPrice(Math.round(sim.data.dirty_money * 0.20))}</span></div>
                  </div>
                )}
              </div>

              {/* Materiais */}
              {paymentMode === 'materials_money' && (
                <>
                  {sim.isLoading ? (
                    <div className="text-xs text-muted-foreground">A calcular materiais...</div>
                  ) : sim.error ? (
                    <div className="text-xs text-destructive">Erro ao calcular materiais.</div>
                  ) : sim.data && sim.data.ingredients.length > 0 ? (
                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">Materiais a entregar</div>
                      <ul className="space-y-0.5 text-xs">
                        {sim.data.ingredients.map((ing) => (
                          <li key={ing.name} className="flex justify-between items-center interactive-row">
                            <span>{ing.name}</span>
                            <span className="font-mono text-muted-foreground">{fmtNum(ing.needed)}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : sim.data ? (
                    <div className="text-xs text-muted-foreground">Não requer materiais.</div>
                  ) : null}
                </>
              )}

              {/* Info extra */}
              <div className="text-xs space-y-1 text-muted-foreground">
                <div className="flex justify-between">
                  <span>Responsável:</span>
                  <span className="text-foreground font-medium">{selectedManager?.display_name ?? selectedManager?.nick ?? "—"}</span>
                </div>
                {notes && (
                  <div className="flex justify-between">
                    <span>Notas:</span>
                    <span className="italic text-right">"{notes}"</span>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep("select")}>
                ← Voltar
              </Button>
              <ButtonLoading
                loading={m.isPending}
                disabled={m.isPending}
                onClick={() => m.mutate()}
              >
                {m.isPending ? "A processar" : "Confirmar encomenda"}
              </ButtonLoading>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
