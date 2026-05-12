import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listKills, addKill } from "@/lib/operations.functions";
import { listMembersLite } from "@/lib/inventory.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { fmtDate } from "@/lib/domain";
import { Skull, Plus } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cemiterio")({ component: Page });

function Page() {
  const fn = useServerFn(listKills);
  const { data, isLoading } = useQuery({ queryKey: ["kills"], queryFn: () => fn() });
  return (
    <>
      <PageHeader eyebrow="RIP" title="Cemitério" description="Quem caiu por mãos do bairro." action={<NewKill />} />
      <div className="space-y-2">
        {isLoading && <p className="text-muted-foreground">A carregar…</p>}
        {(data ?? []).map((k) => (
          <div key={k.id} className="flex items-center gap-4 rounded-sm border border-border bg-card p-3">
            <Skull className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <div className="text-sm"><span className="font-medium">{k.member_name ?? "—"}</span> matou <span className="text-primary font-medium">{k.victim ?? "—"}</span></div>
              {k.notes && <div className="text-xs text-muted-foreground">{k.notes}</div>}
            </div>
            <div className="text-xs text-muted-foreground">{k.weapon ?? ""}</div>
            <div className="text-xs text-muted-foreground">{fmtDate(k.created_at)}</div>
          </div>
        ))}
        {!isLoading && !data?.length && <p className="text-muted-foreground">Cemitério vazio.</p>}
      </div>
    </>
  );
}

function NewKill() {
  const [open, setOpen] = useState(false);
  const membersFn = useServerFn(listMembersLite);
  const addFn = useServerFn(addKill);
  const qc = useQueryClient();
  const members = useQuery({ queryKey: ["membersLite"], queryFn: () => membersFn(), enabled: open });
  const [killer, setKiller] = useState("");
  const [victim, setVictim] = useState("");
  const [spot, setSpot] = useState("");
  const [notes, setNotes] = useState("");
  const m = useMutation({
    mutationFn: () => addFn({ data: { killer_id: Number(killer), victim_name: victim, spot: spot || null, notes: notes || null } }),
    onSuccess: () => { toast.success("Kill registada"); qc.invalidateQueries({ queryKey: ["kills"] }); setOpen(false); setKiller(""); setVictim(""); setSpot(""); setNotes(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="mr-1 h-4 w-4" />Kill</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova kill</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div><label className="text-xs text-muted-foreground">Killer</label>
            <Select value={killer} onValueChange={setKiller}><SelectTrigger><SelectValue placeholder="Membro…" /></SelectTrigger>
              <SelectContent>{(members.data ?? []).map((mb) => <SelectItem key={mb.id} value={String(mb.id)}>{mb.label}</SelectItem>)}</SelectContent></Select></div>
          <div><label className="text-xs text-muted-foreground">Vítima</label><Input value={victim} onChange={(e) => setVictim(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">Spot</label><Input value={spot} onChange={(e) => setSpot(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">Notas</label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button disabled={!killer || !victim || m.isPending} onClick={() => m.mutate()}>{m.isPending ? "A guardar…" : "Registar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
