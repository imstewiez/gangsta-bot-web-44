import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listDeliveries, createDelivery, decideDelivery } from "@/lib/deliveries.functions";
import { getCatalog, getCurrentMember } from "@/lib/pricing.functions";
import type { CatalogItem } from "@/lib/pricing.shared";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { fmtDate, fmtNum } from "@/lib/domain";
import { toast } from "sonner";
import { Plus, Trash2, Check, X, PackageOpen, Package, Coins } from "lucide-react";
import { ItemIcon } from "@/components/domain/ItemIcon";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/entregas")({ component: Page });

// Estados por tipo: a label muda consoante seja entrega vs venda
function statusMeta(tipo: string, status: string): { label: string; color: string } {
  const isVenda = tipo === "venda";
  if (status === "pending") return { label: isVenda ? "à espera de compra" : "à espera", color: "bg-muted text-muted-foreground border-border" };
  if (status === "approved") return { label: isVenda ? "comprado / pago" : "entregue ao bairro", color: "bg-success/15 text-success border-success/30" };
  if (status === "rejected") return { label: isVenda ? "compra recusada" : "entrega recusada", color: "bg-destructive/15 text-destructive border-destructive/30" };
  return { label: status, color: "bg-muted text-muted-foreground border-border" };
}

const TIPO_META: Record<string, { label: string; Icon: LucideIcon; tone: string }> = {
  entrega: { label: "Entrega ao bairro", Icon: Package, tone: "bg-info/15 text-info border-info/30" },
  venda:   { label: "Venda ao bairro",   Icon: Coins,   tone: "bg-warning/15 text-warning border-warning/30" },
};

function Page() {
  const meFn = useServerFn(getCurrentMember);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const isManager = me.data?.is_manager ?? false;
  const [tab, setTab] = useState("mine");
  return (
    <>
      <PageHeader
        eyebrow="Largar à firma"
        title="Entregas"
        description="Lixo, madeiras, mat-primas, minérios, corpos, prints e drogas. A firma paga."
        icon={PackageOpen}
        action={<NewDelivery />}
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="mine">As minhas</TabsTrigger>
          {isManager && <TabsTrigger value="manage">Para conferir</TabsTrigger>}
        </TabsList>
        <TabsContent value="mine" className="mt-4">
          <DelList scope="mine" canDecide={false} />
        </TabsContent>
        {isManager && (
          <TabsContent value="manage" className="mt-4">
            <DelList scope="manage" canDecide />
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}

function DelList({ scope, canDecide }: { scope: "mine" | "manage"; canDecide: boolean }) {
  const fn = useServerFn(listDeliveries);
  const decFn = useServerFn(decideDelivery);
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["deliveries", scope], queryFn: () => fn({ data: { scope } }) });
  const m = useMutation({
    mutationFn: (v: { id: string; approve: boolean }) => decFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      toast.success("Feito.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (list.isLoading) return <p className="text-muted-foreground">A puxar entregas…</p>;
  if (!list.data?.length)
    return (
      <Card className="p-10 text-center">
        <PackageOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
        <p className="text-display text-sm text-muted-foreground">
          {scope === "mine" ? "Ainda não largaste nada à firma." : "Sem entregas para conferir."}
        </p>
      </Card>
    );

  return (
    <div className="grid gap-3">
      {list.data.map((d) => {
        const tipoMeta = TIPO_META[d.tipo] ?? TIPO_META.entrega;
        const st = statusMeta(d.tipo, d.status);
        return (
        <Card key={d.id} className="p-4">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={"inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-display text-[10px] uppercase tracking-wider " + tipoMeta.tone}>
                  <tipoMeta.Icon className="h-3 w-3" /> {tipoMeta.label}
                </span>
                <span className="font-semibold">{d.requester_name ?? "—"}</span>
                <span className="text-xs text-muted-foreground">{fmtDate(d.created_at)}</span>
                <span className={"ml-auto rounded-sm border px-2 py-0.5 text-display text-[10px] uppercase tracking-wider " + st.color}>
                  {st.label}
                </span>
              </div>
              <ul className="mt-3 divide-y divide-border/50 text-sm">
                {d.lines.map((l, i) => (
                  <li key={i} className="flex justify-between py-1">
                    <span className="inline-flex items-center gap-2">
                      <span className="font-mono text-muted-foreground">{l.qty}×</span>
                      <ItemIcon name={l.item_name ?? ""} size={14} />
                      {l.item_name ?? `#${l.item_id}`}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {l.unit_value != null ? fmtNum(l.unit_value * l.qty) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-end justify-between border-t border-border pt-2">
                {d.notes ? (
                  <span className="text-xs italic text-muted-foreground">"{d.notes}"</span>
                ) : <span />}
                <span className="font-mono text-base font-semibold">
                  {fmtNum(d.total_value)}
                </span>
              </div>
            </div>
            {canDecide && d.status === "pending" && (
              <div className="flex flex-col gap-1.5">
                <Button size="sm" onClick={() => m.mutate({ id: d.id, approve: true })} disabled={m.isPending}>
                  <Check className="mr-1 h-3 w-3" />{d.tipo === "venda" ? "Comprar" : "Receber"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => m.mutate({ id: d.id, approve: false })} disabled={m.isPending}>
                  <X className="mr-1 h-3 w-3" />Recusar
                </Button>
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
  const catFn = useServerFn(getCatalog);
  const createFn = useServerFn(createDelivery);
  const qc = useQueryClient();
  const cat = useQuery({ queryKey: ["catalog"], queryFn: () => catFn(), enabled: open });
  const items = (cat.data ?? []).filter((i: CatalogItem) => i.side === "compra");
  const [lines, setLines] = useState<{ item_id: string; qty: string }[]>([{ item_id: "", qty: "1" }]);
  const [notes, setNotes] = useState("");
  const [tipo, setTipo] = useState<"entrega" | "venda">("entrega");
  const m = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          lines: lines
            .filter((l) => l.item_id && l.qty)
            .map((l) => ({ item_id: Number(l.item_id), qty: Number(l.qty) })),
          notes: notes || null,
          tipo,
        },
      }),
    onSuccess: () => {
      toast.success(tipo === "venda" ? "Pedido de compra enviado." : "Entrega submetida. A chefia confirma.");
      qc.invalidateQueries({ queryKey: ["deliveries"] });
      setOpen(false);
      setLines([{ item_id: "", qty: "1" }]);
      setNotes("");
      setTipo("entrega");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" />Largar material
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>O que vens largar?</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">É para…</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipo("entrega")}
                className={
                  "rounded-sm border px-3 py-2 text-left text-sm transition-colors " +
                  (tipo === "entrega"
                    ? "border-info bg-info/15 text-info"
                    : "border-border bg-card hover:bg-accent/30")
                }
              >
                <div className="inline-flex items-center gap-1.5 text-display text-[11px] uppercase tracking-wider"><Package className="h-3 w-3" /> Entregar</div>
                <div className="text-xs text-muted-foreground">Vai para o stock do bairro</div>
              </button>
              <button
                type="button"
                onClick={() => setTipo("venda")}
                className={
                  "rounded-sm border px-3 py-2 text-left text-sm transition-colors " +
                  (tipo === "venda"
                    ? "border-warning bg-warning/15 text-warning"
                    : "border-border bg-card hover:bg-accent/30")
                }
              >
                <div className="inline-flex items-center gap-1.5 text-display text-[11px] uppercase tracking-wider"><Coins className="h-3 w-3" /> Vender</div>
                <div className="text-xs text-muted-foreground">A chefia paga ao morador</div>
              </button>
            </div>
          </div>
          {lines.map((l, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_100px_auto] gap-2">
              <Select
                value={l.item_id}
                onValueChange={(v) => setLines(lines.map((x, i) => (i === idx ? { ...x, item_id: v } : x)))}
              >
                <SelectTrigger><SelectValue placeholder="Item…" /></SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={String(i.id)}>
                      {i.name} <span className="text-muted-foreground">· {i.subcategory}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={1}
                value={l.qty}
                onChange={(e) => setLines(lines.map((x, i) => (i === idx ? { ...x, qty: e.target.value } : x)))}
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
            <Plus className="mr-1 h-4 w-4" />Mais uma linha
          </Button>
          <div>
            <label className="text-xs text-muted-foreground">Recado (opcional)</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? "A enviar…" : "Submeter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
