import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listOrders, createOrder, setOrderStatus } from "@/lib/orders.functions";
import { listItems, listMembersLite } from "@/lib/inventory.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { fmtDate, fmtNum } from "@/lib/domain";
import { toast } from "sonner";
import { Plus, Check, X, Truck } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/encomendas")({ component: Page });

const STATUSES = ["all", "pending", "approved", "fulfilled", "delivered", "cancelled"];

function Page() {
  const [tab, setTab] = useState("pending");
  const fn = useServerFn(listOrders);
  const setFn = useServerFn(setOrderStatus);
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const orders = useQuery({
    queryKey: ["orders", tab],
    queryFn: () => fn({ data: { status: tab === "all" ? null : tab } }),
  });
  const m = useMutation({
    mutationFn: (v: { id: number; status: string }) => setFn({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["orders"] }); toast.success("Atualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <>
      <PageHeader eyebrow="Bairro" title="Encomendas" description="Pedidos de material e entregas." action={<NewOrder />} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>{STATUSES.map((s) => <TabsTrigger key={s} value={s}>{s}</TabsTrigger>)}</TabsList>
      </Tabs>
      <div className="mt-4 overflow-hidden rounded-sm border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-display text-xs">
            <tr><th className="px-3 py-2 text-left">Data</th><th className="px-3 py-2 text-left">Membro</th>
              <th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th></tr>
          </thead>
          <tbody>
            {orders.isLoading && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">A carregar…</td></tr>}
            {(orders.data ?? []).map((o) => (
              <tr key={o.id} className="border-t border-border hover:bg-accent/30">
                <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(o.created_at)}</td>
                <td className="px-3 py-2">{o.member_name ?? "—"}</td>
                <td className="px-3 py-2 font-medium">{o.item_name ?? "—"}</td>
                <td className="px-3 py-2 text-right font-mono">{o.quantity}</td>
                <td className="px-3 py-2 text-right font-mono text-muted-foreground">{o.total_price != null ? fmtNum(o.total_price) : "—"}</td>
                <td className="px-3 py-2 text-center"><span className="rounded-sm bg-muted px-2 py-1 text-xs text-display">{o.status}</span></td>
                <td className="px-3 py-2 text-right">
                  {isAdmin && o.status === "pending" && (
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="outline" onClick={() => m.mutate({ id: o.id, status: "approved" })}><Check className="h-3 w-3" /></Button>
                      <Button size="sm" variant="outline" onClick={() => m.mutate({ id: o.id, status: "cancelled" })}><X className="h-3 w-3" /></Button>
                    </div>
                  )}
                  {isAdmin && o.status === "approved" && (
                    <Button size="sm" variant="outline" onClick={() => m.mutate({ id: o.id, status: "delivered" })}><Truck className="mr-1 h-3 w-3" />Entregar</Button>
                  )}
                </td>
              </tr>
            ))}
            {!orders.isLoading && !orders.data?.length && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Sem encomendas.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

function NewOrder() {
  const [open, setOpen] = useState(false);
  const itemsFn = useServerFn(listItems);
  const membersFn = useServerFn(listMembersLite);
  const createFn = useServerFn(createOrder);
  const qc = useQueryClient();
  const items = useQuery({ queryKey: ["items"], queryFn: () => itemsFn(), enabled: open });
  const members = useQuery({ queryKey: ["membersLite"], queryFn: () => membersFn(), enabled: open });
  const [member, setMember] = useState("");
  const [item, setItem] = useState("");
  const [qty, setQty] = useState("1");
  const [notes, setNotes] = useState("");
  const m = useMutation({
    mutationFn: () => createFn({ data: { member_id: Number(member), item_id: Number(item), quantity: Number(qty), notes: notes || null } }),
    onSuccess: () => { toast.success("Encomenda criada"); qc.invalidateQueries({ queryKey: ["orders"] }); setOpen(false); setMember(""); setItem(""); setQty("1"); setNotes(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Encomenda</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova encomenda</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><label className="text-xs text-muted-foreground">Membro</label>
            <Select value={member} onValueChange={setMember}><SelectTrigger><SelectValue placeholder="Membro…" /></SelectTrigger>
              <SelectContent>{(members.data ?? []).map((mb) => <SelectItem key={mb.id} value={String(mb.id)}>{mb.label}</SelectItem>)}</SelectContent></Select></div>
          <div><label className="text-xs text-muted-foreground">Item</label>
            <Select value={item} onValueChange={setItem}><SelectTrigger><SelectValue placeholder="Item…" /></SelectTrigger>
              <SelectContent>{(items.data ?? []).map((i) => <SelectItem key={i.id} value={String(i.id)}>{i.name}{i.category ? ` · ${i.category}` : ""}</SelectItem>)}</SelectContent></Select></div>
          <div><label className="text-xs text-muted-foreground">Quantidade</label><Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">Notas</label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={!member || !item || !qty || m.isPending} onClick={() => m.mutate()}>{m.isPending ? "A guardar…" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
