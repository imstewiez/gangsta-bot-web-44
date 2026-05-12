import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listDeliveries, createDelivery, decideDelivery, type DeliveryLine } from "@/lib/deliveries.functions";
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
import { Plus, Trash2, Check, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/entregas")({ component: Page });

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  approved: "bg-success/20 text-success",
  rejected: "bg-destructive/20 text-destructive",
};

function Page() {
  const meFn = useServerFn(getCurrentMember);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const isManager = me.data?.is_manager ?? false;
  const [tab, setTab] = useState(isManager ? "manage" : "mine");
  return (
    <>
      <PageHeader eyebrow="Inventário" title="Entregas de material" description="Material entregue à org (lixo, madeiras, mat-primas, minérios, corpos, prints, drogas)." action={<NewDelivery />} />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="mine">Minhas</TabsTrigger>
          {isManager && <TabsTrigger value="manage">Gestão</TabsTrigger>}
        </TabsList>
        <TabsContent value="mine" className="mt-4"><DelTable scope="mine" canDecide={false} /></TabsContent>
        {isManager && <TabsContent value="manage" className="mt-4"><DelTable scope="manage" canDecide /></TabsContent>}
      </Tabs>
    </>
  );
}

function DelTable({ scope, canDecide }: { scope: "mine" | "manage"; canDecide: boolean }) {
  const fn = useServerFn(listDeliveries);
  const decFn = useServerFn(decideDelivery);
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["deliveries", scope], queryFn: () => fn({ data: { scope } }) });
  const m = useMutation({
    mutationFn: (v: { id: string; approve: boolean }) => decFn({ data: v }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["deliveries"] }); toast.success("Atualizado"); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="grid gap-3">
      {list.isLoading && <p className="text-muted-foreground">A carregar…</p>}
      {(list.data ?? []).map((d) => (
        <div key={d.id} className="rounded-sm border border-border bg-card p-4">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{d.requester_name ?? "—"}</span>
                <span className="text-xs text-muted-foreground">{fmtDate(d.created_at)}</span>
                <span className={"ml-auto rounded-sm px-2 py-1 text-display text-xs " + (STATUS_COLOR[d.status] ?? "bg-muted")}>{d.status}</span>
              </div>
              <ul className="mt-2 text-sm space-y-0.5">
                {d.lines.map((l, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{l.item_name ?? `#${l.item_id}`} × {l.qty}</span>
                    <span className="font-mono text-muted-foreground">{l.unit_value != null ? fmtNum(l.unit_value * l.qty) : "—"}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex justify-between text-xs">
                <span className="text-muted-foreground">{d.notes}</span>
                <span className="font-mono font-semibold">Total: {fmtNum(d.total_value)}</span>
              </div>
            </div>
            {canDecide && d.status === "pending" && (
              <div className="flex flex-col gap-1">
                <Button size="sm" onClick={() => m.mutate({ id: d.id, approve: true })}><Check className="mr-1 h-3 w-3" />Aprovar</Button>
                <Button size="sm" variant="outline" onClick={() => m.mutate({ id: d.id, approve: false })}><X className="mr-1 h-3 w-3" />Rejeitar</Button>
              </div>
            )}
          </div>
        </div>
      ))}
      {!list.isLoading && !list.data?.length && <p className="text-muted-foreground">Sem entregas.</p>}
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
  const m = useMutation({
    mutationFn: () => createFn({ data: {
      lines: lines.filter((l) => l.item_id && l.qty).map((l) => ({ item_id: Number(l.item_id), qty: Number(l.qty) })),
      notes: notes || null,
    } }),
    onSuccess: () => { toast.success("Entrega submetida"); qc.invalidateQueries({ queryKey: ["deliveries"] }); setOpen(false); setLines([{ item_id: "", qty: "1" }]); setNotes(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Nova entrega</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Entregar material</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          {lines.map((l, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_100px_auto] gap-2">
              <Select value={l.item_id} onValueChange={(v) => setLines(lines.map((x, i) => i === idx ? { ...x, item_id: v } : x))}>
                <SelectTrigger><SelectValue placeholder="Item…" /></SelectTrigger>
                <SelectContent>
                  {items.map((i) => <SelectItem key={i.id} value={String(i.id)}>{i.name} · {i.subcategory}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="number" min={1} value={l.qty} onChange={(e) => setLines(lines.map((x, i) => i === idx ? { ...x, qty: e.target.value } : x))} />
              <Button size="sm" variant="ghost" onClick={() => setLines(lines.filter((_, i) => i !== idx))} disabled={lines.length === 1}><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button size="sm" variant="outline" onClick={() => setLines([...lines, { item_id: "", qty: "1" }])}><Plus className="mr-1 h-4 w-4" />Adicionar linha</Button>
          <div><label className="text-xs text-muted-foreground">Notas</label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={m.isPending} onClick={() => m.mutate()}>{m.isPending ? "A guardar…" : "Submeter"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
