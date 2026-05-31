import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { useEffect, useMemo, useState } from "react";
import {
  addOrderComment,
  cancelOwnOrder,
  createOrder,
  listOrderComments,
  listOrders,
  transitionOrder,
} from "@/lib/orders.functions";
import { computeCraftFeasibilityBatch } from "@/lib/recipes.functions";
import { getCatalog, getCurrentMember } from "@/lib/pricing.functions";
import { listManagers } from "@/lib/members.functions";
import type { CatalogItem } from "@/lib/pricing.shared";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { ButtonLoading } from "@/components/ui/ButtonLoading";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { fmtCategoryLabel, fmtDate, fmtNum, fmtPrice } from "@/lib/domain";
import { ARMORY_CAT_CONFIG, ARMORY_CAT_ORDER, filterItemForDisplay } from "@/lib/armory.catalog";
import { getOrderAllowedCategories } from "@/lib/config.loader";
import { toast } from "sonner";
import { beautifyError, EMPTY_STATE, LOADING } from "@/lib/messages";
import { Banknote, Loader2, MessageSquare, Package, Plus, Send, ShoppingBag, Trash2 } from "lucide-react";
import { PageErrorBoundary } from "@/components/layout/PageErrorBoundary";
import { FadeIn } from "@/components/layout/FadeIn";
import { Reveal } from "@/components/layout/Reveal";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/encomendas")({
  errorComponent: PageErrorBoundary,
  head: () => ({ meta: [{ title: "Encomendas | Ballas Gang" }] }),
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

const NEXT_STATES: Record<string, { to: OrderStatus; label: string; variant?: "destructive" | "default" }[]> = {
  pending: [
    { to: "approved", label: "Aceitar" },
    { to: "denied", label: "Recusar", variant: "destructive" },
  ],
  approved: [{ to: "in_progress", label: "Pôr a tratar" }],
  in_progress: [{ to: "ready", label: "Marcar pronta" }],
  ready: [{ to: "fulfilled", label: "Entregue" }],
};

const ACTIVE_STATUSES = ["pending", "approved", "in_progress", "ready"];
const ARCHIVED_STATUSES = ["fulfilled", "denied", "cancelled"];

type PaymentMode = "materials_money" | "money_only";
type OrderStatus = "pending" | "approved" | "in_progress" | "ready" | "fulfilled" | "denied" | "cancelled";
type OrderLineInput = { item_id: string; qty: string };

function positive(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function priceWithMaterials(item: CatalogItem | undefined | null): number {
  return Number(
    positive(item?.tier_price) ??
    positive(item?.min_sale_price) ??
    positive(item?.purchase_price) ??
    positive(item?.morador_purchase_price) ??
    0,
  );
}

function priceWithoutMaterials(item: CatalogItem | undefined | null): number {
  return Number(
    positive(item?.purchase_price) ??
    positive(item?.tier_price) ??
    positive(item?.min_sale_price) ??
    positive(item?.morador_purchase_price) ??
    0,
  );
}

function itemUnitPrice(item: CatalogItem | undefined | null, mode: PaymentMode): number {
  return mode === "materials_money" ? priceWithMaterials(item) : priceWithoutMaterials(item);
}

function lineQuantity(line: OrderLineInput): number {
  const qty = Number(line.qty);
  return Number.isFinite(qty) && qty > 0 ? qty : 0;
}

function Page() {
  useRealtimeSync([
    { table: "orders", queryKeys: [["orders"], ["stock"], ["my-xp"]] },
    { table: "order_comments", queryKeys: [["order_comments"]] },
  ]);

  const meFn = useAuthedServerFn(getCurrentMember);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const isManager = me.data?.is_manager ?? false;
  const [tab, setTab] = useState("mine");
  const [mineSub, setMineSub] = useState("active");
  const [manageSub, setManageSub] = useState("active");

  return (
    <>
      <PageHeader eyebrow="Operação" title="Encomendas" description="Pedidos e encomendas" icon={ShoppingBag} action={<NewOrder />} />
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
              <TabsContent value="active"><Reveal direction="up" delay={0}><OrdersList scope="mine" canManage={false} meId={me.data?.id} statusFilter="active" /></Reveal></TabsContent>
              <TabsContent value="archived"><Reveal direction="up" delay={100}><OrdersList scope="mine" canManage={false} meId={me.data?.id} statusFilter="archived" /></Reveal></TabsContent>
            </Tabs>
          </TabsContent>

          {isManager && (
            <TabsContent value="manage" className="mt-4">
              <Tabs value={manageSub} onValueChange={setManageSub}>
                <TabsList className="mb-3">
                  <TabsTrigger value="active" className="interactive-tab">A decorrer</TabsTrigger>
                  <TabsTrigger value="archived" className="interactive-tab">Arquivo de Encomendas</TabsTrigger>
                </TabsList>
                <TabsContent value="active"><Reveal direction="up" delay={200}><OrdersList scope="manage" canManage meId={me.data?.id} statusFilter="active" /></Reveal></TabsContent>
                <TabsContent value="archived"><Reveal direction="up" delay={300}><OrdersList scope="manage" canManage meId={me.data?.id} statusFilter="archived" /></Reveal></TabsContent>
              </Tabs>
            </TabsContent>
          )}
        </Tabs>
      </FadeIn>
    </>
  );
}

function OrdersList({ scope, canManage, meId, statusFilter }: { scope: "mine" | "manage"; canManage: boolean; meId?: number; statusFilter: "active" | "archived" }) {
  const fn = useAuthedServerFn(listOrders);
  const transFn = useAuthedServerFn(transitionOrder);
  const cancelFn = useAuthedServerFn(cancelOwnOrder);
  const qc = useQueryClient();
  const statuses = statusFilter === "active" ? ACTIVE_STATUSES : ARCHIVED_STATUSES;
  const orders = useQuery({ queryKey: ["orders", scope, statusFilter], queryFn: () => fn({ data: { scope, statuses } }) });

  const transitionM = useMutation({
    mutationFn: (v: { id: number; to: OrderStatus }) => transFn({ data: { id: v.id, to: v.to } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      toast.success("Guardado");
    },
    onError: (e: Error) => toast.error(beautifyError(e)),
  });

  const cancelM = useMutation({
    mutationFn: (ids: number[]) => cancelFn({ data: { ids } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Encomenda cancelada — verifica o Histórico");
    },
    onError: (e: Error) => toast.error(beautifyError(e)),
  });

  const batches = useMemo(() => {
    if (!orders.data) return [];
    const map = new Map<string, typeof orders.data>();
    for (const order of orders.data) {
      const key = order.batch_id ?? `single-${order.id}`;
      if (!map.has(key)) map.set(key, [] as typeof orders.data);
      map.get(key)!.push(order);
    }
    return Array.from(map.entries()).sort((a, b) => (b[1][0]?.created_at ?? "").localeCompare(a[1][0]?.created_at ?? ""));
  }, [orders.data]);

  if (orders.isLoading) {
    return <div className="flex h-64 flex-col items-center justify-center gap-3"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /><p className="text-sm text-muted-foreground">{LOADING.orders}</p></div>;
  }

  if (!orders.data?.length) {
    return (
      <Card className="interactive-card p-10 text-center">
        <ShoppingBag className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">{statusFilter === "active" ? EMPTY_STATE.orders.title : EMPTY_STATE.ordersHistory.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{statusFilter === "active" ? EMPTY_STATE.orders.description : EMPTY_STATE.ordersHistory.description}</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {batches.map(([batchId, lines]) => {
        const first = lines[0];
        const next = canManage ? NEXT_STATES[first.status] : null;
        const minId = Math.min(...lines.map((l) => l.id));
        const totalBatch = lines.reduce((sum, line) => sum + (line.total_price ?? 0), 0);
        const isOwn = meId != null && first.member_id === meId;
        const canCancelOwn = !canManage && isOwn && statusFilter === "active" && first.status === "pending";

        const materialMap = new Map<string, number>();
        for (const line of lines) {
          for (const ingredient of line.ingredients_json ?? []) {
            materialMap.set(ingredient.name, (materialMap.get(ingredient.name) ?? 0) + ingredient.needed);
          }
        }
        const aggregatedIngredients = Array.from(materialMap.entries()).map(([name, needed]) => ({ name, needed }));
        const hasMaterials = first.payment_mode === "materials_money" && aggregatedIngredients.length > 0;

        const handleTransition = async (to: OrderStatus) => {
          await Promise.all(lines.map((line) => transitionM.mutateAsync({ id: line.id, to })));
        };

        const handleCancel = async () => {
          if (!confirm("Tens a certeza que queres cancelar esta encomenda?")) return;
          await cancelM.mutateAsync(lines.map((line) => line.id));
        };

        return (
          <Card key={batchId} className={cn("interactive-card p-4", !hasMaterials && "border-amber-500/30 bg-amber-500/[0.02]")}>
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-[200px] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-display text-xs text-muted-foreground">#{minId}</span>
                  <span className={cn("rounded-sm border px-2 py-0.5 text-display text-[10px] uppercase tracking-wider", STATUS_COLOR[first.status])}>{STATUS_LABEL[first.status] ?? first.status}</span>
                  {hasMaterials ? (
                    <span className="inline-flex items-center gap-1 rounded-sm border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400"><Package className="h-3 w-3" /> Com materiais</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-sm border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400"><Banknote className="h-3 w-3" /> Sem materiais</span>
                  )}
                  <span className="text-xs text-muted-foreground">{fmtDate(first.created_at)}</span>
                </div>

                <div className="mt-2 space-y-1">
                  {lines.map((line) => (
                    <div key={line.id} className="interactive-row flex items-center justify-between text-sm">
                      <span className="font-semibold">{line.quantity}× {line.item_name ?? "—"}</span>
                      <span className="font-mono text-xs text-muted-foreground">{line.total_price != null ? fmtPrice(line.total_price) : "—"}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-1.5 text-sm text-muted-foreground">
                  Para <span className="text-foreground">{first.member_name ?? "—"}</span>
                  {first.responsavel_name && <span className="mt-0.5 block">Responsável: <span className="font-medium text-foreground">{first.responsavel_name}</span></span>}
                  {first.notes && <span className="mt-1 block italic">&quot;{first.notes}&quot;</span>}
                </div>

                <div className={cn("mt-2 space-y-1.5 rounded-sm border p-2 text-xs", hasMaterials ? "border-border bg-muted/30" : "border-amber-500/20 bg-amber-500/5")}>
                  {hasMaterials ? (
                    <>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Materiais a entregar</div>
                      <ul className="space-y-0.5">
                        {aggregatedIngredients.map((ingredient) => (
                          <li key={ingredient.name} className="interactive-row flex items-center justify-between"><span className="text-foreground">{ingredient.name}</span><span className="font-mono text-muted-foreground">{fmtNum(ingredient.needed)}</span></li>
                        ))}
                      </ul>
                      <div className="flex items-center justify-between border-t border-border pt-1.5 font-semibold">
                        <span className="text-emerald-400">Dinheiro:</span>
                        <span className="font-mono text-emerald-400">{fmtPrice(Math.round(totalBatch))}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-1.5 text-amber-400"><Banknote className="h-3.5 w-3.5" /><span className="font-semibold">Pagamento só em dinheiro</span><span className="text-muted-foreground">— sem materiais a entregar</span></div>
                  )}
                </div>
              </div>

              <div className="text-right"><div className="font-mono text-lg font-semibold">{fmtPrice(totalBatch)}</div><div className="font-mono text-xs text-muted-foreground">{lines.length} artigo{lines.length !== 1 ? "s" : ""}</div></div>

              {(next?.length || canCancelOwn) && (
                <div className="flex w-full justify-end gap-1.5 border-t border-border pt-3">
                  {canCancelOwn && <ButtonLoading size="sm" variant="outline" loading={cancelM.isPending} onClick={handleCancel} className="text-destructive hover:text-destructive">Cancelar</ButtonLoading>}
                  {next?.map((state) => (
                    <ButtonLoading key={state.to} size="sm" variant={state.variant === "destructive" ? "outline" : "default"} loading={transitionM.isPending} onClick={() => handleTransition(state.to)}>{state.label}</ButtonLoading>
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

  const comments = useQuery({ queryKey: ["order_comments", orderId], queryFn: () => commentsFn({ data: { order_id: orderId } }), enabled: open });
  const addM = useMutation({
    mutationFn: (content: string) => addCommentFn({ data: { order_id: orderId, content } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["order_comments", orderId] }); setText(""); },
    onError: (e: Error) => toast.error(beautifyError(e)),
  });

  return (
    <div className="mt-3 border-t border-border pt-2">
      <button onClick={() => setOpen((value) => !value)} className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"><MessageSquare className="h-3.5 w-3.5" />{comments.data?.length ? `${comments.data.length} comentário${comments.data.length !== 1 ? "s" : ""}` : "Comentários"}</button>
      {open && (
        <div className="mt-2 space-y-2">
          {comments.isLoading && <div className="py-4 text-xs text-muted-foreground">A carregar comentários...</div>}
          {comments.error && <p className="text-xs text-destructive">{(comments.error as Error).message}</p>}
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {(comments.data ?? []).map((comment) => (
              <div key={comment.id} className="rounded-sm bg-muted/40 p-2 text-sm"><div className="flex items-center justify-between"><span className="text-xs font-medium">{comment.author_name ?? "—"}</span><span className="text-[10px] text-muted-foreground">{fmtDate(comment.created_at)}</span></div><p className="mt-0.5 text-sm text-foreground">{comment.content}</p></div>
            ))}
            {!comments.isLoading && !(comments.data ?? []).length && <p className="py-4 text-center text-xs text-muted-foreground">Sem comentários.</p>}
          </div>
          {canComment && <div className="flex gap-2"><Input value={text} onChange={(event) => setText(event.target.value)} placeholder="Escrever comentário..." className="h-8 text-sm" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && text.trim()) { event.preventDefault(); addM.mutate(text.trim()); } }} /><ButtonLoading size="sm" loading={addM.isPending} disabled={!text.trim()} onClick={() => addM.mutate(text.trim())} className="h-8 px-2"><Send className="h-3.5 w-3.5" /></ButtonLoading></div>}
        </div>
      )}
    </div>
  );
}

function NewOrder() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"select" | "checkout">("select");
  const [lines, setLines] = useState<OrderLineInput[]>([{ item_id: "", qty: "1" }]);
  const [notes, setNotes] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("money_only");

  const catFn = useAuthedServerFn(getCatalog);
  const createFn = useAuthedServerFn(createOrder);
  const simFn = useAuthedServerFn(computeCraftFeasibilityBatch);
  const managersFn = useAuthedServerFn(listManagers);
  const qc = useQueryClient();

  const catalog = useQuery({ queryKey: ["catalog"], queryFn: () => catFn(), enabled: open });
  const managers = useQuery({ queryKey: ["managers"], queryFn: () => managersFn(), enabled: open });
  const allowedCategories = getOrderAllowedCategories();

  const items = useMemo(() => (catalog.data ?? []).filter((item: CatalogItem) => {
    const category = filterItemForDisplay(item.name, item.category, item.subcategory);
    return Boolean(category && allowedCategories.includes(category));
  }), [allowedCategories, catalog.data]);

  const itemsById = useMemo(() => new Map(items.map((item) => [String(item.id), item])), [items]);
  const validLines = lines.filter((line) => line.item_id && lineQuantity(line) > 0);

  const sim = useQuery({
    queryKey: ["order-sim-batch", validLines.map((line) => `${line.item_id}:${line.qty}`).join(",")],
    queryFn: () => simFn({ data: { lines: validLines.map((line) => ({ item_id: Number(line.item_id), quantity: lineQuantity(line) })) } }),
    enabled: open && validLines.length > 0,
  });

  const hasMaterialQuote = Boolean(sim.data && sim.data.ingredients.length > 0);
  const effectivePaymentMode: PaymentMode = hasMaterialQuote ? paymentMode : "money_only";
  const finalTotal = validLines.reduce((sum, line) => sum + itemUnitPrice(itemsById.get(line.item_id), effectivePaymentMode) * lineQuantity(line), 0);
  const selectedManager = (managers.data ?? []).find((manager) => String(manager.id) === responsavel);

  useEffect(() => {
    if (sim.data && sim.data.ingredients.length === 0 && paymentMode !== "money_only") setPaymentMode("money_only");
  }, [paymentMode, sim.data]);

  const options = useMemo(() => {
    const groups = new Map<string, CatalogItem[]>();
    for (const item of items) {
      const category = filterItemForDisplay(item.name, item.category, item.subcategory);
      if (!category) continue;
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category)!.push(item);
    }
    const result: { value: string; label: string; group: string; groupColor?: string }[] = [];
    for (const category of ARMORY_CAT_ORDER) {
      const list = groups.get(category);
      if (!list) continue;
      const cfg = ARMORY_CAT_CONFIG[category as keyof typeof ARMORY_CAT_CONFIG];
      list.sort((a, b) => priceWithoutMaterials(a) - priceWithoutMaterials(b));
      result.push(...list.map((item) => ({ value: String(item.id), label: item.name, group: cfg?.label ?? fmtCategoryLabel(category), groupColor: cfg?.headerColor })));
    }
    return result;
  }, [items]);

  const createM = useMutation({
    mutationFn: () => createFn({ data: { lines: validLines.map((line) => ({ item_id: Number(line.item_id), quantity: lineQuantity(line) })), notes: notes || null, responsavel_member_id: responsavel ? Number(responsavel) : null, payment_mode: effectivePaymentMode } }),
    onSuccess: () => { toast.success("Encomenda registada"); qc.invalidateQueries({ queryKey: ["orders"] }); handleClose(); },
    onError: (e: Error) => toast.error(beautifyError(e)),
  });

  function handleClose() {
    setOpen(false); setStep("select"); setLines([{ item_id: "", qty: "1" }]); setNotes(""); setResponsavel(""); setPaymentMode("money_only");
  }
  function updateLine(index: number, patch: Partial<OrderLineInput>) { setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line))); }
  const canReview = validLines.length > 0 && Boolean(responsavel) && !sim.isLoading && !sim.isError && finalTotal > 0;

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" /> Encomendar</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{step === "select" ? "O que precisas?" : "Confirma a tua encomenda"}</DialogTitle></DialogHeader>
        {step === "select" ? (
          <>
            <div className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1">
              {lines.map((line, index) => <div key={index} className="grid grid-cols-[1fr_100px_auto] gap-2"><SearchableSelect value={line.item_id} onChange={(value) => updateLine(index, { item_id: value })} options={options} placeholder="Material" searchPlaceholder="Procurar item..." emptyText="Nenhum material encontrado." /><Input type="number" min={1} value={line.qty} onChange={(event) => updateLine(index, { qty: event.target.value })} /><Button size="sm" variant="ghost" onClick={() => setLines((current) => current.filter((_, i) => i !== index))} disabled={lines.length === 1}><Trash2 className="h-4 w-4" /></Button></div>)}
              <Button size="sm" variant="outline" onClick={() => setLines((current) => [...current, { item_id: "", qty: "1" }])}><Plus className="mr-1 h-4 w-4" /> Mais uma linha</Button>
              {validLines.length > 0 && !sim.isLoading && <PaymentModePicker hasMaterialQuote={hasMaterialQuote} paymentMode={paymentMode} setPaymentMode={setPaymentMode} />}
              {validLines.length > 0 && sim.isError && <div className="rounded-sm border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">Não foi possível calcular a encomenda. Confirma receitas/preços na Gestão de Materiais.</div>}
              <div><label className="mb-1 block text-xs text-muted-foreground">Responsável</label><Select value={responsavel} onValueChange={setResponsavel}><SelectTrigger><SelectValue placeholder="Seleciona quem gere isto" /></SelectTrigger><SelectContent>{(managers.data ?? []).map((manager) => <SelectItem key={manager.id} value={String(manager.id)}>{manager.display_name ?? manager.nick ?? `Membro #${manager.id}`}</SelectItem>)}</SelectContent></Select></div>
              <div><label className="text-xs text-muted-foreground">Notas (opcional)</label><Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder="Notas" /></div>
            </div>
            <DialogFooter><Button variant="ghost" onClick={handleClose}>Deixa lá</Button><Button disabled={!canReview} onClick={() => setStep("checkout")}>Rever encomenda →</Button></DialogFooter>
          </>
        ) : (
          <>
            <div className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1">
              <div className={cn("flex items-center gap-2 rounded-sm border p-2 text-xs", effectivePaymentMode === "money_only" ? "border-amber-500/30 bg-amber-500/10 text-amber-400" : "border-blue-500/30 bg-blue-500/10 text-blue-400")}>{effectivePaymentMode === "money_only" ? <Banknote className="h-3.5 w-3.5" /> : <Package className="h-3.5 w-3.5" />}<span className="font-medium">{effectivePaymentMode === "money_only" ? "Só dinheiro" : "Materiais + dinheiro"}</span></div>
              <div><div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Itens</div><ul className="space-y-0.5 text-sm">{validLines.map((line, index) => { const item = itemsById.get(line.item_id); const qty = lineQuantity(line); const unit = itemUnitPrice(item, effectivePaymentMode); return <li key={index} className="interactive-row flex items-center justify-between"><span className="font-medium">{qty}× {item?.name ?? "—"}</span><span className="font-mono text-xs text-muted-foreground">{fmtPrice(unit * qty)}</span></li>; })}</ul></div>
              <div className="rounded-sm border border-border bg-muted/30 p-3"><div className="flex items-center justify-between text-sm font-semibold"><span>Total a pagar:</span><span className="font-mono">{fmtPrice(Math.round(finalTotal))}</span></div>{effectivePaymentMode === "money_only" && hasMaterialQuote && <div className="mt-1 text-[10px] text-muted-foreground">A ser usado o preço sem materiais definido na Gestão de Materiais.</div>}</div>
              {effectivePaymentMode === "materials_money" && hasMaterialQuote && <div><div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Materiais a entregar</div><ul className="space-y-0.5 text-xs">{(sim.data?.ingredients ?? []).map((ingredient) => <li key={ingredient.name} className="interactive-row flex items-center justify-between"><span>{ingredient.name}</span><span className="font-mono text-muted-foreground">{fmtNum(ingredient.needed)}</span></li>)}</ul></div>}
              {!hasMaterialQuote && <div className="rounded-sm border border-amber-500/20 bg-amber-500/5 p-2 text-xs text-muted-foreground">Esta encomenda não requer materiais. Vais pagar apenas o preço definido do artigo.</div>}
              <div className="space-y-1 text-xs text-muted-foreground"><div className="flex justify-between"><span>Responsável:</span><span className="font-medium text-foreground">{selectedManager?.display_name ?? selectedManager?.nick ?? "—"}</span></div>{notes && <div className="flex justify-between gap-3"><span>Notas:</span><span className="text-right italic">&quot;{notes}&quot;</span></div>}</div>
            </div>
            <DialogFooter><Button variant="ghost" onClick={() => setStep("select")}>← Voltar</Button><ButtonLoading loading={createM.isPending} disabled={createM.isPending} onClick={() => createM.mutate()}>{createM.isPending ? "A processar" : "Confirmar encomenda"}</ButtonLoading></DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PaymentModePicker({ hasMaterialQuote, paymentMode, setPaymentMode }: { hasMaterialQuote: boolean; paymentMode: PaymentMode; setPaymentMode: (mode: PaymentMode) => void }) {
  if (!hasMaterialQuote) {
    return <div><label className="mb-1 block text-xs text-muted-foreground">Modo de encomenda</label><div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-400"><div className="flex items-center gap-2 font-semibold"><Banknote className="h-4 w-4" /> Só dinheiro</div><p className="mt-1 text-[10px] text-muted-foreground">Os artigos selecionados não têm receita/material associado, por isso não existe opção de entregar materiais.</p></div></div>;
  }
  return (
    <div><label className="mb-1 block text-xs text-muted-foreground">Modo de encomenda</label><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setPaymentMode("materials_money")} className={cn("rounded-lg border p-3 text-left transition-colors", paymentMode === "materials_money" ? "border-primary bg-primary/10" : "border-border bg-muted/30 hover:bg-muted/50")}><Package className={cn("mb-1.5 h-5 w-5", paymentMode === "materials_money" ? "text-primary" : "text-muted-foreground")} /><div className={cn("text-xs font-semibold", paymentMode === "materials_money" ? "text-primary" : "text-foreground")}>Com materiais</div><div className="mt-0.5 text-[10px] leading-tight text-muted-foreground">Entrego a receita definida + pago o preço com material</div></button><button type="button" onClick={() => setPaymentMode("money_only")} className={cn("rounded-lg border p-3 text-left transition-colors", paymentMode === "money_only" ? "border-primary bg-primary/10" : "border-border bg-muted/30 hover:bg-muted/50")}><Banknote className={cn("mb-1.5 h-5 w-5", paymentMode === "money_only" ? "text-primary" : "text-muted-foreground")} /><div className={cn("text-xs font-semibold", paymentMode === "money_only" ? "text-primary" : "text-foreground")}>Sem materiais</div><div className="mt-0.5 text-[10px] leading-tight text-muted-foreground">Pago o preço sem materiais definido</div></button></div></div>
  );
}
