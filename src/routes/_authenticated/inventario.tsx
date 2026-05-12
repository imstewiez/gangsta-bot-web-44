import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getStock, getLedger, listItems, listMembersLite, createMovement } from "@/lib/inventory.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { fmtNum, fmtDate } from "@/lib/domain";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/inventario")({ component: Page });

const TYPES = ["entrada", "saida", "ajuste", "consumo", "venda", "entrega"];

function Page() {
  const stockFn = useServerFn(getStock);
  const ledgerFn = useServerFn(getLedger);
  const stock = useQuery({ queryKey: ["stock"], queryFn: () => stockFn() });
  const ledger = useQuery({ queryKey: ["ledger"], queryFn: () => ledgerFn({ data: { limit: 100 } }) });
  return (
    <>
      <PageHeader eyebrow="Material" title="Inventário" description="Stock total e movimentos recentes."
        action={<NewMovementButton />} />
      <Tabs defaultValue="stock">
        <TabsList><TabsTrigger value="stock">Stock</TabsTrigger><TabsTrigger value="ledger">Ledger</TabsTrigger></TabsList>
        <TabsContent value="stock">
          <div className="overflow-hidden rounded-sm border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-display text-xs"><tr><th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2 text-left">Categoria</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Preço</th></tr></thead>
              <tbody>
                {stock.isLoading && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">A carregar…</td></tr>}
                {(stock.data ?? []).map((r) => (
                  <tr key={r.item_id} className="border-t border-border hover:bg-accent/30">
                    <td className="px-3 py-2 font-medium">{r.item_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.category ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtNum(r.qty)}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{r.unit_price != null ? fmtNum(r.unit_price) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="ledger">
          <div className="overflow-hidden rounded-sm border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-display text-xs"><tr><th className="px-3 py-2 text-left">Data</th><th className="px-3 py-2 text-left">Tipo</th><th className="px-3 py-2 text-left">Item</th><th className="px-3 py-2 text-left">Membro</th><th className="px-3 py-2 text-right">Qty</th></tr></thead>
              <tbody>
                {ledger.isLoading && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">A carregar…</td></tr>}
                {(ledger.data ?? []).map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-accent/30">
                    <td className="px-3 py-2 text-xs text-muted-foreground">{fmtDate(r.created_at)}</td>
                    <td className="px-3 py-2">{r.type}</td>
                    <td className="px-3 py-2">{r.item_name ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.member_name ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmtNum(r.qty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

function NewMovementButton() {
  const [open, setOpen] = useState(false);
  const itemsFn = useServerFn(listItems);
  const membersFn = useServerFn(listMembersLite);
  const createFn = useServerFn(createMovement);
  const qc = useQueryClient();
  const items = useQuery({ queryKey: ["items"], queryFn: () => itemsFn(), enabled: open });
  const members = useQuery({ queryKey: ["membersLite"], queryFn: () => membersFn(), enabled: open });
  const [movement_type, setType] = useState("entrada");
  const [item_id, setItem] = useState<string>("");
  const [quantity, setQty] = useState("1");
  const [member_id, setMember] = useState<string>("");
  const [notes, setNotes] = useState("");
  const m = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          movement_type,
          item_id: Number(item_id),
          quantity: Number(quantity),
          member_id: member_id ? Number(member_id) : null,
          notes: notes || null,
        },
      }),
    onSuccess: () => {
      toast.success("Movimento registado");
      qc.invalidateQueries({ queryKey: ["stock"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      setOpen(false);
      setItem(""); setQty("1"); setMember(""); setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" />Movimento</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo movimento</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Tipo</label>
            <Select value={movement_type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Item</label>
            <Select value={item_id} onValueChange={setItem}>
              <SelectTrigger><SelectValue placeholder="Escolher item…" /></SelectTrigger>
              <SelectContent>{(items.data ?? []).map((i) => <SelectItem key={i.id} value={String(i.id)}>{i.name}{i.category ? ` · ${i.category}` : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Quantidade (negativa = saída)</label>
            <Input type="number" value={quantity} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Membro (opcional)</label>
            <Select value={member_id} onValueChange={setMember}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{(members.data ?? []).map((mb) => <SelectItem key={mb.id} value={String(mb.id)}>{mb.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Notas</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={!item_id || !quantity || m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? "A guardar…" : "Registar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
