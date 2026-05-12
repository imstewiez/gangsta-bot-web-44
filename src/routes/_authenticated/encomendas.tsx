import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listOrders, createOrder, transitionOrder } from "@/lib/orders.functions";
import { getCatalog, getCurrentMember, type CatalogItem } from "@/lib/pricing.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { fmtDate, fmtNum } from "@/lib/domain";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/encomendas")({ component: Page });

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  approved: "bg-warning/20 text-warning",
  in_progress: "bg-primary/20 text-primary",
  ready: "bg-primary/30 text-primary",
  fulfilled: "bg-success/20 text-success",
  denied: "bg-destructive/20 text-destructive",
  cancelled: "bg-destructive/10 text-destructive",
};

const NEXT_STATES: Record<string, { to: string; label: string }[]> = {
  pending: [{ to: "approved", label: "Aceitar" }, { to: "denied", label: "Rejeitar" }],
  approved: [{ to: "in_progress", label: "Em curso" }, { to: "cancelled", label: "Cancelar" }],
  in_progress: [{ to: "ready", label: "Pronta" }],
  ready: [{ to: "fulfilled", label: "Confirmar entrega" }],
};

function Page() {
  const meFn = useServerFn(getCurrentMember);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const isManager = me.data?.is_manager ?? false;
  const [tab, setTab] = useState(isManager ? "manage" : "mine");

  return (
    <>
      <PageHeader eyebrow="Bairro" title="Encomendas" description="Pedidos de armas, carregadores, coletes e acessórios." action={<NewOrder />} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="mine">Minhas</TabsTrigger>
          {isManager && <TabsTrigger value="manage">Gestão</TabsTrigger>}
        </TabsList>
        <TabsContent value="mine" className="mt-4"><OrdersTable scope="mine" canManage={false} /></TabsContent>
        {isManager && <TabsContent value="manage" className="mt-4"><OrdersTable scope="manage" canManage /></TabsContent>}
      </Tabs>
    </>
  );
}

function OrdersTable({ scope, canManage }: { scope: "mine" | "manage"; canManage: boolean }) {
  const fn = useServerFn(listOrders);
  const transFn = useServerFn(transitionOrder);
  const qc = useQueryClient();
  const orders = useQuery({
    queryKey: ["orders", scope],
    queryFn: () => fn({ data: { scope } }),
  });
  const m = useMutation({
    mutationFn: (v: { id: number; to: string }) => transFn({ data: v as { id: number; to: "pending" | "approved" | "in_progress" | "ready" | "fulfilled" | "denied" | "cancelled" } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["orders"] }); toast.success("Atualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="overflow-hidden rounded-sm border border-border">
      <table className="w-full text-sm">
        <thead className="bg-secondary text-display text-xs">
          <tr>
            <th className="px-3 py-2 text-left">Data</th>
            <th className="px-3 py-2 text-left">Membro</th>
            <th className="px-3 py-2 text-left">Item</th>
            <th className="px-3 py-2 text-right">Qty</th>
            <th className="px-3 py-2 text-right">Unit.</th>
            <th className="px-3 py-2 text-right">Total</th>
            <th className="px-3 py-2">Estado</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {orders.isLoading && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">A carregar…</td></tr>}
          {(orders.data ?? []).map((o) => (
            <tr key={o.id} className="border-t border-border hover:bg-accent/30">
              <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(o.created_at)}</td>
              <td className="px-3 py-2">{o.member_name ?? "—"}</td>
              <td className="px-3 py-2 font-medium">{o.item_name ?? "—"}</td>
              <td className="px-3 py-2 text-right font-mono">{o.quantity}</td>
              <td className="px-3 py-2 text-right font-mono text-muted-foreground">{o.unit_price != null ? fmtNum(o.unit_price) : "—"}</td>
              <td className="px-3 py-2 text-right font-mono">{o.total_price != null ? fmtNum(o.total_price) : "—"}</td>
              <td className="px-3 py-2 text-center">
                <span className={"rounded-sm px-2 py-1 text-xs text-display " + (STATUS_COLOR[o.status] ?? "bg-muted")}>{o.status}</span>
              </td>
              <td className="px-3 py-2 text-right">
                {canManage && NEXT_STATES[o.status] && (
                  <div className="flex gap-1 justify-end">
                    {NEXT_STATES[o.status].map((s) => (
                      <Button key={s.to} size="sm" variant="outline" disabled={m.isPending} onClick={() => m.mutate({ id: o.id, to: s.to })}>
                        {s.label}
                      </Button>
                    ))}
                  </div>
                )}
              </td>
            </tr>
          ))}
          {!orders.isLoading && !orders.data?.length && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">Sem encomendas.</td></tr>}
        </tbody>
      </table>
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
    mutationFn: () => createFn({ data: { item_id: Number(item), quantity: Number(qty), notes: notes || null } }),
    onSuccess: () => { toast.success("Encomenda criada"); qc.invalidateQueries({ queryKey: ["orders"] }); setOpen(false); setItem(""); setQty("1"); setNotes(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Nova encomenda</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova encomenda</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Item</label>
            <Select value={item} onValueChange={setItem}>
              <SelectTrigger><SelectValue placeholder="Item…" /></SelectTrigger>
              <SelectContent>
                {items.map((i) => <SelectItem key={i.id} value={String(i.id)}>{i.name} · {i.subcategory}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><label className="text-xs text-muted-foreground">Quantidade</label><Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">Notas</label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={!item || !qty || m.isPending} onClick={() => m.mutate()}>{m.isPending ? "A guardar…" : "Pedir"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
