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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/entregas")({
  component: Page,
});

type DeliveryTipo = "entrega" | "venda";
type DeliveryLineInput = { item_id: string; qty: string };
type DeliveryStatusFilter = "active" | "archived";

function statusMeta(tipo: string, status: string): { label: string; color: string } {
  const isVenda = tipo === "venda";
  if (status === "pending") return { label: "Pendente", color: "bg-muted text-muted-foreground border-border" };
  if (status === "approved") return { label: isVenda ? "Comprada" : "Recebida", color: "bg-success/15 text-success border-success/30" };
  if (status === "rejected") return { label: "Recusada", color: "bg-destructive/15 text-destructive border-destructive/30" };
  return { label: status, color: "bg-muted text-muted-foreground border-border" };
}

const TIPO_META: Record<string, { label: string; Icon: LucideIcon; tone: string }> = {
  entrega: { label: "Entrega", Icon: Package, tone: "bg-info/15 text-info border-info/30" },
  venda: { label: "Venda", Icon: Coins, tone: "bg-warning/15 text-warning border-warning/30" },
};

function lineQty(line: DeliveryLineInput) {
  const qty = Number(line.qty);
  return Number.isFinite(qty) && qty > 0 ? qty : 0;
}

function Page() {
  useRealtimeSync([
    { table: "inventory_delivery_requests", queryKeys: [["deliveries"], ["chefia-kpis"]] },
    { table: "inventory_movements", queryKeys: [["deliveries"], ["stock"], ["ledger"], ["my-xp"], ["home-kpis"]] },
    { table: "inventory_balance", queryKeys: [["stock"], ["chefia-kpis"]] },
  ]);

  const meFn = useAuthedServerFn(getCurrentMember);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const isManager = me.data?.is_manager ?? false;
  const [tab, setTab] = useState("mine");
  const [mineSub, setMineSub] = useState<DeliveryStatusFilter>("active");
  const [manageSub, setManageSub] = useState<DeliveryStatusFilter>("active");

  return (
    <>
      <PageHeader eyebrow="Operação" title="Entregas" icon={PackageOpen} action={<NewDelivery />} />
      <Reveal direction="up">
        <FadeIn>
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="mine" className="interactive-tab">As minhas</TabsTrigger>
              {isManager && <TabsTrigger value="manage" className="interactive-tab">Para conferir</TabsTrigger>}
            </TabsList>
            <TabsContent value="mine" className="mt-4">
              <Tabs value={mineSub} onValueChange={(v) => setMineSub(v as DeliveryStatusFilter)}>
                <TabsList className="mb-3">
                  <TabsTrigger value="active" className="interactive-tab">A decorrer</TabsTrigger>
                  <TabsTrigger value="archived" className="interactive-tab">Histórico</TabsTrigger>
                </TabsList>
                <TabsContent value="active"><DelList scope="mine" canDecide={false} statusFilter="active" /></TabsContent>
                <TabsContent value="archived"><DelList scope="mine" canDecide={false} statusFilter="archived" /></TabsContent>
              </Tabs>
            </TabsContent>
            {isManager && (
              <TabsContent value="manage" className="mt-4">
                <Tabs value={manageSub} onValueChange={(v) => setManageSub(v as DeliveryStatusFilter)}>
                  <TabsList className="mb-3">
                    <TabsTrigger value="active" className="interactive-tab">A decorrer</TabsTrigger>
                    <TabsTrigger value="archived" className="interactive-tab">Histórico</TabsTrigger>
                  </TabsList>
                  <TabsContent value="active"><DelList scope="manage" canDecide statusFilter="active" /></TabsContent>
                  <TabsContent value="archived"><DelList scope="manage" canDecide={false} statusFilter="archived" /></TabsContent>
                </Tabs>
              </TabsContent>
            )}
          </Tabs>
        </FadeIn>
      </Reveal>
    </>
  );
}

function DelList({ scope, canDecide, statusFilter }: { scope: "mine" | "manage"; canDecide: boolean; statusFilter: DeliveryStatusFilter }) {
  const fn = useAuthedServerFn(listDeliveries);
  const decFn = useAuthedServerFn(decideDelivery);
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["deliveries", scope, statusFilter], queryFn: () => fn({ data: { scope, statusFilter } }) });
  const rows = list.data ?? [];

  const m = useMutation({
    mutationFn: (v: { id: string; approve: boolean }) => decFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      qc.invalidateQueries({ queryKey: ["my-xp"] });
      qc.invalidateQueries({ queryKey: ["home-kpis"] });
      qc.invalidateQueries({ queryKey: ["chefia-kpis"] });
      toast.success("Guardado");
    },
    onError: (e: Error) => toast.error(beautifyError(e)),
  });

  if (list.isLoading) {
    return <div className="flex h-64 flex-col items-center justify-center gap-3"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /><p className="text-sm text-muted-foreground">{LOADING.deliveries}</p></div>;
  }

  if (list.error) {
    return <Card className="interactive-card p-6 text-sm text-destructive">{beautifyError(list.error)}</Card>;
  }

  if (!rows.length) {
    return (
      <Card className="interactive-card p-10 text-center">
        <PackageOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">{scope === "mine" ? (statusFilter === "active" ? EMPTY_STATE.deliveries.title : EMPTY_STATE.deliveriesHistory?.title ?? "Sem histórico") : statusFilter === "active" ? EMPTY_STATE.deliveriesPending.title : EMPTY_STATE.deliveriesHistory?.title ?? "Sem arquivo"}</p>
        <p className="mt-1 text-xs text-muted-foreground">{scope === "mine" ? (statusFilter === "active" ? EMPTY_STATE.deliveries.description : EMPTY_STATE.deliveriesHistory?.description ?? "Ainda não há entregas fechadas.") : statusFilter === "active" ? EMPTY_STATE.deliveriesPending.description : EMPTY_STATE.deliveriesHistory?.description ?? "Ainda não há entregas arquivadas."}</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-3">
      {rows.map((d) => {
        const tipoMeta = TIPO_META[d.tipo] ?? TIPO_META.entrega;
        const st = statusMeta(d.tipo, d.status);
        const totalValue = d.tipo === "entrega" ? 0 : d.total_value;
        return (
          <Card key={d.id} className={cn("interactive-card p-4", d.tipo === "venda" ? "border-warning/30" : "border-info/30")}>
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-[200px] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider", tipoMeta.tone)}>
                    <tipoMeta.Icon className="h-3.5 w-3.5" /> {tipoMeta.label}
                  </span>
                  <span className="font-semibold">{d.requester_name ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">{fmtDate(d.created_at)}</span>
                  <span className={cn("ml-auto rounded-xl border px-2 py-0.5 text-display text-[10px] uppercase tracking-wider", st.color)}>{st.label}</span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">Responsável: <span className="text-foreground">{d.responsavel_name ?? "—"}</span></div>
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
                <div className="flex w-full justify-end gap-1.5 border-t border-border pt-3 sm:w-auto sm:flex-col sm:border-t-0 sm:pt-0">
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

  const items = useMemo(() => allItems.filter((i) => i.side === "compra" || i.side === "ambos"), [allItems]);
  const validLines = lines.filter((line) => line.item_id && lineQty(line) > 0);
  const selectedValue = validLines.reduce((acc, line) => {
    const item = allItems.find((i) => String(i.id) === line.item_id);
    return acc + lineQty(line) * (item?.morador_purchase_price ?? item?.purchase_price ?? 0);
  }, 0);

  const mutation = useMutation({
    mutationFn: () => createFn({ data: { lines: validLines.map((l) => ({ item_id: Number(l.item_id), qty: Number(l.qty) })), notes, tipo, responsavel_member_id: Number(responsavel) } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      qc.invalidateQueries({ queryKey: ["chefia-kpis"] });
      toast.success(tipo === "venda" ? "Venda enviada" : "Entrega enviada");
      setOpen(false);
      setLines([{ item_id: "", qty: "1" }]);
      setNotes("");
      setTipo("entrega");
      setResponsavel("");
    },
    onError: (e: Error) => toast.error(beautifyError(e)),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Nova entrega</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Registar entrega/venda</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Tipo</label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as DeliveryTipo)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="entrega">Entrega à firma</SelectItem>
                <SelectItem value="venda">Venda ao morador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Responsável por conferir</label>
            <SearchableSelect
              value={responsavel}
              onValueChange={setResponsavel}
              placeholder="Escolhe um responsável"
              searchPlaceholder="Pesquisar responsável..."
              emptyText="Nenhum responsável encontrado"
              options={(managers.data ?? []).map((m) => ({ value: String(m.id), label: m.display_name ?? `#${m.id}`, description: m.tier ?? undefined }))}
            />
          </div>
          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_100px_36px] gap-2">
                <SearchableSelect
                  value={line.item_id}
                  onValueChange={(value) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, item_id: value } : l)))}
                  placeholder="Item"
                  searchPlaceholder="Pesquisar item..."
                  emptyText="Nenhum item encontrado"
                  options={items.map((it) => ({ value: String(it.id), label: it.name, description: `${fmtCategoryLabel(it.category)} · ${fmtPrice(it.morador_purchase_price ?? it.purchase_price ?? 0)}` }))}
                />
                <Input type="number" min={1} value={line.qty} onChange={(e) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, qty: e.target.value } : l)))} />
                <Button variant="outline" size="icon" disabled={lines.length === 1} onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setLines((prev) => [...prev, { item_id: "", qty: "1" }])}>Adicionar linha</Button>
          </div>
          <Textarea placeholder="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm">
            <div className="flex justify-between"><span>Quantidade total</span><strong>{fmtNum(validLines.reduce((a, l) => a + lineQty(l), 0))}</strong></div>
            {tipo === "venda" && <div className="flex justify-between"><span>Valor estimado</span><strong>{fmtPrice(selectedValue)}</strong></div>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <ButtonLoading loading={mutation.isPending} onClick={() => mutation.mutate()} disabled={validLines.length === 0 || !responsavel}>Enviar</ButtonLoading>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
