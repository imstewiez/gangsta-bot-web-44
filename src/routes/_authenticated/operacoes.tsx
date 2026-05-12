import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listSaidas, createOperation } from "@/lib/operations.functions";
import { listMembersLite } from "@/lib/inventory.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { fmtDate } from "@/lib/domain";
import { Plus, Crosshair } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/operacoes")({ component: Page });

const STATUS_COLOR: Record<string, string> = {
  planeada: "bg-muted text-muted-foreground",
  em_curso: "bg-warning/20 text-warning",
  em_liquidacao: "bg-primary/20 text-primary",
  fechada: "bg-success/20 text-success",
};

const TYPES = ["bagueta", "monte", "labs", "guetto", "treino", "outro"];

function Page() {
  const fn = useServerFn(listSaidas);
  const { data, isLoading } = useQuery({ queryKey: ["saidas"], queryFn: () => fn() });
  return (
    <>
      <PageHeader eyebrow="PvP" title="Operações / Saídas" description={`${data?.length ?? 0} registos.`} action={<NewSaida />} />
      <div className="grid gap-3">
        {isLoading && <p className="text-muted-foreground">A carregar…</p>}
        {(data ?? []).map((s) => (
          <div key={s.id} className="flex items-center gap-4 rounded-sm border border-border bg-card p-4">
            <div className="text-display text-2xl text-primary w-12 text-center">#{s.id}</div>
            <div className="flex-1">
              <div className="font-medium">{s.tipo ?? "—"} · <span className="text-muted-foreground">{s.spot ?? "—"}</span></div>
              <div className="text-xs text-muted-foreground">{fmtDate(s.scheduled_at)}</div>
            </div>
            <div className="text-sm">{s.participant_count} <span className="text-muted-foreground">part.</span></div>
            <span className={"rounded-sm px-2 py-1 text-display text-xs " + (STATUS_COLOR[s.status] ?? "bg-muted")}>{s.status}</span>
          </div>
        ))}
        {!isLoading && !data?.length && <p className="text-muted-foreground">Sem operações.</p>}
      </div>
    </>
  );
}

function NewSaida() {
  const [open, setOpen] = useState(false);
  const membersFn = useServerFn(listMembersLite);
  const createFn = useServerFn(createOperation);
  const qc = useQueryClient();
  const members = useQuery({ queryKey: ["membersLite"], queryFn: () => membersFn(), enabled: open });
  const [type, setType] = useState("bagueta");
  const [spot, setSpot] = useState("");
  const [leader, setLeader] = useState("");
  const [when, setWhen] = useState("");
  const [notes, setNotes] = useState("");
  const m = useMutation({
    mutationFn: () => createFn({ data: { operation_type: type, spot: spot || null, leader_id: leader ? Number(leader) : null, scheduled_at: when || null, notes: notes || null } }),
    onSuccess: () => { toast.success("Saída criada"); qc.invalidateQueries({ queryKey: ["saidas"] }); setOpen(false); setSpot(""); setLeader(""); setWhen(""); setNotes(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Saída</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova saída</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><label className="text-xs text-muted-foreground">Tipo</label>
            <Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
          <div><label className="text-xs text-muted-foreground">Spot</label><Input value={spot} onChange={(e) => setSpot(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">Líder</label>
            <Select value={leader} onValueChange={setLeader}><SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{(members.data ?? []).map((mb) => <SelectItem key={mb.id} value={String(mb.id)}>{mb.label}</SelectItem>)}</SelectContent></Select></div>
          <div><label className="text-xs text-muted-foreground">Agendado para</label>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">Notas</label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={!type || m.isPending} onClick={() => m.mutate()}>{m.isPending ? "A guardar…" : "Criar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
