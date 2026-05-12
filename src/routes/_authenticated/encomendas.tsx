import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listOrders, createOrder, transitionOrder } from "@/lib/orders.functions";
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
import { Plus, ShoppingBag } from "lucide-react";

export const Route = createFileRoute("/_authenticated/encomendas")({ component: Page });

const STATUS_LABEL: Record<string, string> = {
  pending: "à espera",
  approved: "aceite",
  in_progress: "a tratar",
  ready: "pronta",
  fulfilled: "entregue",
  denied: "recusada",
  cancelled: "cancelada",
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

const NEXT_STATES: Record<string, { to: string; label: string; variant?: "destructive" | "default" }[]> = {
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

function Page() {
  const meFn = useServerFn(getCurrentMember);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const isManager = me.data?.is_manager ?? false;
  const [tab, setTab] = useState<string>("mine");

  return (
    <>
      <PageHeader
        eyebrow="Loja da firma"
        title="Encomendas"
        description="Armas, carregadores, coletes e acessórios. Pede e a chefia trata."
        action={<NewOrder />}
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="mine">As minhas</TabsTrigger>
          {isManager && <TabsTrigger value="manage">Para tratar</TabsTrigger>}
        </TabsList>
        <TabsContent value="mine" className="mt-4">
          <OrdersList scope="mine" canManage={false} />
        </TabsContent>
        {isManager && (
          <TabsContent value="manage" className="mt-4">
            <OrdersList scope="manage" canManage />
          </TabsContent>
        )}
      </Tabs>
    </>
  );
}

function OrdersList({ scope, canManage }: { scope: "mine" | "manage"; canManage: boolean }) {
  const fn = useServerFn(listOrders);
  const transFn = useServerFn(transitionOrder);
  const qc = useQueryClient();
  const orders = useQuery({
    queryKey: ["orders", scope],
    queryFn: () => fn({ data: { scope } }),
  });
  const m = useMutation({
    mutationFn: (v: { id: number; to: string }) =>
      transFn({
        data: v as { id: number; to: "pending" | "approved" | "in_progress" | "ready" | "fulfilled" | "denied" | "cancelled" },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["stock"] });
      toast.success("Feito.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (orders.isLoading) return <p className="text-muted-foreground">A puxar pedidos…</p>;
  if (!orders.data?.length)
    return (
      <Card className="p-10 text-center">
        <ShoppingBag className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
        <p className="text-display text-sm text-muted-foreground">
          {scope === "mine" ? "Ainda não pediste nada." : "Caixa de entrada limpa."}
        </p>
      </Card>
    );

  return (
    <div className="grid gap-3">
      {orders.data.map((o) => {
        const next = canManage ? NEXT_STATES[o.status] : null;
        return (
          <Card key={o.id} className="p-4">
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2">
                  <span className="text-display text-xs text-muted-foreground">#{o.id}</span>
                  <span className={"rounded-sm border px-2 py-0.5 text-display text-[10px] uppercase tracking-wider " + (STATUS_COLOR[o.status] ?? "")}>
                    {STATUS_LABEL[o.status] ?? o.status}
                  </span>
                  <span className="text-xs text-muted-foreground">{fmtDate(o.created_at)}</span>
                </div>
                <div className="mt-1.5 text-base font-semibold">
                  {o.quantity}× {o.item_name ?? "—"}
                </div>
                <div className="text-sm text-muted-foreground">
                  Para <span className="text-foreground">{o.member_name ?? "—"}</span>
                  {o.notes && <span className="block mt-1 italic">"{o.notes}"</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono text-lg font-semibold">
                  {o.total_price != null ? fmtNum(o.total_price) : "—"}
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {o.unit_price != null ? `${fmtNum(o.unit_price)}/un` : ""}
                </div>
              </div>
              {next && (
                <div className="flex w-full justify-end gap-1.5 border-t border-border pt-3">
                  {next.map((s) => (
                    <Button
                      key={s.to}
                      size="sm"
                      variant={s.variant === "destructive" ? "outline" : "default"}
                      disabled={m.isPending}
                      onClick={() => m.mutate({ id: o.id, to: s.to })}
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function NewOrder() {
  const [open, setOpen] = useState(false);
  const catFn = useServerFn(getCatalog);
  const createFn = useServerFn(createOrder);
  const qc = useQueryClient();
  const cat = useQuery({ queryKey: ["catalog"], queryFn: () => catFn(), enabled: open });
  const items = (cat.data ?? []).filter((i: CatalogItem) => i.side === "venda");
  const [item, setItem] = useState("");
  const [qty, setQty] = useState("1");
  const [notes, setNotes] = useState("");
  const m = useMutation({
    mutationFn: () =>
      createFn({ data: { item_id: Number(item), quantity: Number(qty), notes: notes || null } }),
    onSuccess: () => {
      toast.success("Pedido feito. A chefia já viu.");
      qc.invalidateQueries({ queryKey: ["orders"] });
      setOpen(false);
      setItem("");
      setQty("1");
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-4 w-4" />Encomendar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>O que precisas?</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Item</label>
            <Select value={item} onValueChange={setItem}>
              <SelectTrigger><SelectValue placeholder="Escolhe…" /></SelectTrigger>
              <SelectContent>
                {items.map((i) => (
                  <SelectItem key={i.id} value={String(i.id)}>
                    {i.name} <span className="text-muted-foreground">· {i.subcategory}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Quantidade</label>
            <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Recado (opcional)</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Para quê, para quando…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Deixa lá</Button>
          <Button disabled={!item || !qty || m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? "A enviar…" : "Pedir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
