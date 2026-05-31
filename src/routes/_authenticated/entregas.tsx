import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useMemo, useState } from "react";
import { listDeliveries, createDelivery, decideDelivery } from "@/lib/deliveries.functions";
import { getCatalog, getBuyCatalog, getCurrentMember } from "@/lib/pricing.functions";
import { listManagers } from "@/lib/members.functions";
import type { CatalogItem } from "@/lib/pricing.shared";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { ButtonLoading } from "@/components/ui/ButtonLoading";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { fmtDate, fmtNum, fmtPrice, fmtCategoryLabel } from "@/lib/domain";
import { ARMORY_CAT_ORDER, ARMORY_CAT_CONFIG, filterItemForDisplay } from "@/lib/armory.catalog";
import { toast } from "sonner";
import { beautifyError, EMPTY_STATE, LOADING } from "@/lib/messages";
import { Plus, Trash2, Check, X, PackageOpen, Package, Coins, Loader2 } from "lucide-react";
import { ItemIcon } from "@/components/domain/ItemIcon";
import type { LucideIcon } from "lucide-react";
import { FadeIn } from "@/components/layout/FadeIn";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Reveal } from "@/components/layout/Reveal";

export const Route = createFileRoute("/_authenticated/entregas")({
  component: Page,
});

type DeliveryTipo = "entrega" | "venda";
type DeliveryLineInput = { item_id: string; qty: string };

function statusMeta(tipo: string, status: string): { label: string; color: string } {
  const isVenda = tipo === "venda";
  if (status === "pending") return { label: "Pendente", color: "bg-muted text-muted-foreground border-border" };
  if (status === "approved") return { label: isVenda ? "Comprada" : "Recebida", color: "bg-success/15 text-success border-success/30" };
  if (status === "rejected") return { label: "Recusada", color: "bg-destructive/15 text-destructive border-destructive/30" };
  return { label: status, color: "bg-muted text-muted-foreground border-border" };
}

const TIPO_META: Record<string, { label: string; Icon: LucideIcon; tone: string }> = {
  entrega: { label: "Entrega de stock", Icon: Package, tone: "bg-info/15 text-info border-info/30" },
  venda: { label: "Venda interna", Icon: Coins, tone: "bg-warning/15 text-warning border-warning/30" },
};

function lineQty(line: DeliveryLineInput) {
  const qty = Number(line.qty);
  return Number.isFinite(qty) && qty > 0 ? qty : 0;
}

function Page() {
  useRealtimeSync([
    { table: "inventory_delivery_requests", queryKeys: [["deliveries"]] },
    { table: "inventory_movements", queryKeys: [["stock"], ["ledger"], ["my-xp"]] },
    { table: "inventory_balance", queryKeys: [["stock"]] },
  ]);

  const meFn = useAuthedServerFn(getCurrentMember);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const isManager = me.data?.is_manager ?? false;
  const [tab, setTab] = useState("mine");

  return (
    <>
      <PageHeader eyebrow="Entregas" title="Entregas" description="Registo de entregas e vendas internas" action={<NewDelivery />} />
      <Reveal direction="up">
        <FadeIn>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="mine" className="interactive-tab">As minhas</TabsTrigger>
              {isManager && <TabsTrigger value="manage" className="interactive-tab">Para conferir</TabsTrigger>}
            </TabsList>
            <TabsContent value="mine" className="mt-4"><DelList scope="mine" canDecide={false} /></TabsContent>
            {isManager && <TabsContent value="manage" className="mt-4"><DelList scope="manage" canDecide /></TabsContent>}
          </Tabs>
        </FadeIn>
      </Reveal>
    </>
  );
}

function DelList({ scope, canDecide }: { scope: "mine" | "manage"; canDecide: boolean }) {
  const fn = useAuthedServerFn(listDeliveries);
  const decFn = useAuthedServerFn(decideDelivery);
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["deliveries", scope], queryFn: () => fn({ data: { scope } }) });

  const m = useMutation({
    mutationFn: (v: { id: string; approve: boolean }) => decFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      qc.invalidateQueries({ queryKey: ["my-xp"] });
      qc.invalidateQueries({ queryKey: ["home-kpis"] });
      toast.success("Guardado");
    },
    onError: (e: Error) => toast.error(beautifyError(e)),
  });

  if (list.isLoading) {
    return <div className="flex h-64 flex-col items-center justify-center gap-3"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /><p className="text-sm text-muted-foreground">{LOADING.deliveries}</p></div>;
  }

  if (!list.data?.length) {
    return (
      <Card className="interactive-card p-10 text-center">
        <PackageOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">{scope === "mine" ? EMPTY_STATE.deliveries.title : EMPTY_STATE.deliveriesPending.title}</p>
        <p className="mt-1 text-xs text-muted-foreground">{scope === "mine" ? EMPTY_STATE.deliveries.description : EMPTY_STATE.deliveriesPending.description}</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {list.data.map((d) => {
        const tipoMeta = TIPO_META[d.tipo] ?? TIPO_META.entrega;
        const st = statusMeta(d.tipo, d.status);
        const totalValue = d.tipo === "entrega" ? 0 : d.total_value;
        return (
          <Card key={d.id} className={`interactive-card p-4 border-l-4 ${d.tipo === "venda" ? "border-l-warning" : "border-l-info"}`}>
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${tipoMeta.tone}`}>
                    <tipoMeta.Icon className="h-3.5 w-3.5" /> {tipoMeta.label}
                  </span>
                  <span className="font-semibold">{d.requester_name ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">{fmtDate(d.created_at)}</span>
                  <span className={`ml-auto rounded-sm border px-2 py-0.5 text-display text-[10px] uppercase tracking-wider ${st.color}`}>{st.label}</span>
                </div>

                {d.responsavel_name && <div className="mt-1 text-xs text-muted-foreground">Responsável: <span className="text-foreground">{d.responsavel_name}</span></div>}

                <ul className="mt-3 divide-y divide-border/50 text-sm">
                  {d.lines.map((l, i) => (
                    <li key={i} className="interactive-row flex justify-between py-1">
                      <span className="inline-flex items-center gap-2">
                        <span className="font-mono text-muted-foreground">{fmtNum(l.qty)}×</span>
                        <ItemIcon name={l.item_name ?? ""} size={14} />
                        {l.item_name ?? `#${l.item_id}`}
                      </span>
                      <span className="font-mono text-muted-foreground">{d.tipo === "entrega" ? "0€" : l.unit_value != null ? fmtPrice(l.unit_value * l.qty) : "—"}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3 flex items-end justify-between border-t border-border pt-2">
                  {d.notes ? <span className="text-xs italic text-muted-foreground">&quot;{d.notes}&quot;</span> : <span />}
                  <span className="inline-flex items-center gap-1.5 font-mono text-base font-semibold">
                    {d.tipo === "venda" ? <Coins className="h-4 w-4 text-warning" /> : <Package className="h-4 w-4 text-info" />}
                    {fmtPrice(totalValue)}
                  </span>
                </div>
              </div>

              {canDecide && d.status === "pending" && (
                <div className="flex flex-col gap-1.5">
                  <ButtonLoading size="sm" loading={m.isPending} onClick={() => m.mutate({ id: d.id, approve: true })} disabled={m.isPending}>
                    <Check className="mr-1 h-3 w-3" />{d.tipo === "venda" ? "Comprar" : "Receber"}
                  </ButtonLoading>
                  <ButtonLoading size="sm" variant="outline" loading={m.isPending} onClick={() => m.mutate({ id: d.id, approve: false })} disabled={m.isPending}>
                    <X className="mr-1 h-3 w-3" />Recusar
                  </ButtonLoading>
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function NewDelivery() {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<DeliveryTipo>("entrega");
  const [lines, setLines] = useState<DeliveryLineInput[]>([{ item_id: "", qty: "1" }]);
  const [notes, setNotes] = useState("");
  const [responsavel, setResponsavel] = useState("");

  const catFn = useAuthedServerFn(getCatalog);
  const buyCatFn = useAuthedServerFn(getBuyCatalog);
  const createFn = useAuthedServerFn(createDelivery);
  const managersFn = useAuthedServerFn(listManagers);
  const qc = useQueryClient();

  const cat = useQuery({ queryKey: ["catalog"], queryFn: () => catFn(), enabled: open });
  const buyCat = useQuery({ queryKey: ["buyCatalog"], queryFn: () => buyCatFn(), enabled: open });
  const managers = useQuery({ queryKey: ["managers"], queryFn: () => managersFn(), enabled: open });

  const allItems = useMemo(() => {
    const map = new Map<number, CatalogItem>();
    for (const i of cat.data ?? []) map.set(i.id, i);
    for (const i of buyCat.data ?? []) map.set(i.id, i);
    return Array.from(map.values());
  }, [cat.data, buyCat.data]);

  const items = useMemo(() => allItems.filter((i) => tipo === "entrega" ? i.side === "compra" || i.side === "ambos" : i.side === "venda" || i.side === "ambos"), [allItems, tipo]);
  const validLines = lines.filter((line) => line.item_id && lineQty(line) > 0);
  const hasResponsible = Boolean(responsavel);
  const hasManagers = (managers.data ?? []).length > 0;
  const canSubmit = hasResponsible && hasManagers && validLines.length > 0 && !mIsBusy(cat.isLoading, buyCat.isLoading, managers.isLoading);

  const deliveryOptions = useMemo(() => {
    const groups = new Map<string, CatalogItem[]>();
    for (const i of items) {
      const catKey = filterItemForDisplay(i.name, i.category, i.subcategory);
      if (!catKey) continue;
      if (!groups.has(catKey)) groups.set(catKey, []);
      groups.get(catKey)!.push(i);
    }
    const result: { value: string; label: string; group: string; groupColor?: string }[] = [];
    for (const catKey of ARMORY_CAT_ORDER) {
      const list = groups.get(catKey);
      if (!list) continue;
      const cfg = ARMORY_CAT_CONFIG[catKey];
      result.push(...list.map((i) => ({ value: String(i.id), label: `${i.name} · ${cfg?.label ?? fmtCategoryLabel(catKey)}`, group: cfg?.label ?? fmtCategoryLabel(catKey), groupColor: cfg?.headerColor })));
    }
    return result;
  }, [items]);

  function handleClose() {
    setOpen(false);
    setLines([{ item_id: "", qty: "1" }]);
    setNotes("");
    setTipo("entrega");
    setResponsavel("");
  }

  const m = useMutation({
    mutationFn: () => createFn({ data: { lines: validLines.map((l) => ({ item_id: Number(l.item_id), qty: lineQty(l) })), notes: notes || null, tipo, responsavel_member_id: Number(responsavel) } }),
    onSuccess: () => {
      toast.success(tipo === "venda" ? "Venda submetida para confirmação." : "Entrega submetida para confirmação.");
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      handleClose();
    },
    onError: (e: Error) => toast.error(beautifyError(e)),
  });

  function updateLine(index: number, patch: Partial<DeliveryLineInput>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function changeTipo(nextTipo: DeliveryTipo) {
    setTipo(nextTipo);
    setLines([{ item_id: "", qty: "1" }]);
  }

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Nova entrega</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{tipo === "venda" ? <Coins className="h-5 w-5 text-warning" /> : <Package className="h-5 w-5 text-info" />}{tipo === "venda" ? "Registar venda interna" : "Registar entrega de stock"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Responsável obrigatório</label>
            <Select value={responsavel} onValueChange={setResponsavel}>
              <SelectTrigger className={!hasResponsible ? "border-destructive/50" : undefined}><SelectValue placeholder="Seleciona quem vai conferir" /></SelectTrigger>
              <SelectContent>{(managers.data ?? []).map((mgr) => <SelectItem key={mgr.id} value={String(mgr.id)}>{mgr.display_name ?? mgr.nick ?? `Membro #${mgr.id}`}</SelectItem>)}</SelectContent>
            </Select>
            {!hasResponsible && <p className="mt-1 text-[11px] text-destructive">Tens de escolher um responsável para a entrega aparecer em “Para conferir”.</p>}
            {!managers.isLoading && !hasManagers && <p className="mt-1 text-[11px] text-destructive">Não há responsáveis disponíveis. Confirma cargos/permissões dos membros.</p>}
          </div>

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => changeTipo("entrega")} className={`rounded-sm cursor-pointer border px-3 py-2 text-left text-sm transition-colors ${tipo === "entrega" ? "border-info bg-info/15 text-info" : "border-border bg-card interactive-row"}`}>
                <div className="inline-flex items-center gap-1.5 text-display text-[11px] uppercase tracking-wider"><Package className="h-3 w-3" />Entregar</div>
                <div className="text-xs text-muted-foreground">Entra no inventário a custo 0</div>
              </button>
              <button type="button" onClick={() => changeTipo("venda")} className={`rounded-sm cursor-pointer border px-3 py-2 text-left text-sm transition-colors ${tipo === "venda" ? "border-warning bg-warning/15 text-warning" : "border-border bg-card interactive-row"}`}>
                <div className="inline-flex items-center gap-1.5 text-display text-[11px] uppercase tracking-wider"><Coins className="h-3 w-3" />Vender</div>
                <div className="text-xs text-muted-foreground">Venda/aquisição a conferir</div>
              </button>
            </div>
          </div>

          {lines.map((line, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_100px_auto] gap-2">
              <SearchableSelect value={line.item_id} onChange={(value) => updateLine(idx, { item_id: value })} options={deliveryOptions} placeholder="Material" searchPlaceholder="Procurar item..." emptyText="Nenhum item encontrado." />
              <Input type="number" min={1} value={line.qty} onChange={(e) => updateLine(idx, { qty: e.target.value })} />
              <Button size="sm" variant="ghost" onClick={() => setLines((current) => current.filter((_, i) => i !== idx))} disabled={lines.length === 1}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}

          <Button size="sm" variant="outline" onClick={() => setLines((current) => [...current, { item_id: "", qty: "1" }])}><Plus className="mr-1 h-4 w-4" />Mais uma linha</Button>
          <div><label className="text-xs text-muted-foreground">Notas (opcional)</label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
          <ButtonLoading loading={m.isPending} disabled={!canSubmit || m.isPending} onClick={() => m.mutate()}>{m.isPending ? "A processar" : "Submeter para conferência"}</ButtonLoading>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function mIsBusy(...values: boolean[]) {
  return values.some(Boolean);
}
