import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listPrizes, setPrize, generatePrizeForCurrentWeek } from "@/lib/prizes.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fmtDate, fmtNum } from "@/lib/domain";
import { toast } from "sonner";
import { Trophy, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/premios")({ component: Page });

function Page() {
  const fn = useServerFn(listPrizes);
  const setFn = useServerFn(setPrize);
  const genFn = useServerFn(generatePrizeForCurrentWeek);
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const prizes = useQuery({ queryKey: ["prizes"], queryFn: () => fn() });
  const [editId, setEditId] = useState<number | null>(null);
  const [desc, setDesc] = useState("");
  const [status, setStatus] = useState("pending");
  const [notes, setNotes] = useState("");
  const m = useMutation({
    mutationFn: () => setFn({ data: { id: editId!, description: desc, status, notes } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prizes"] }); toast.success("Atualizado"); setEditId(null); },
    onError: (e: Error) => toast.error(e.message),
  });
  const gen = useMutation({
    mutationFn: () => genFn(),
    onSuccess: (r: { created: boolean }) => { qc.invalidateQueries({ queryKey: ["prizes"] }); toast.success(r.created ? "Prémio gerado" : "Já existia"); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <>
      <PageHeader eyebrow="Ranking" title="Prémios semanais"
        description="Top semanal — o vencedor leva o prémio."
        action={isAdmin ? <Button size="sm" onClick={() => gen.mutate()} disabled={gen.isPending}><Sparkles className="mr-1 h-4 w-4" />Gerar para a semana</Button> : null}
      />
      <div className="space-y-2">
        {prizes.isLoading && <p className="text-muted-foreground">A carregar…</p>}
        {(prizes.data ?? []).map((p) => (
          <div key={p.id} className="flex items-center gap-4 rounded-sm border border-border bg-card p-4">
            <Trophy className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <div className="font-medium">{p.winner_name ?? "—"} · <span className="text-muted-foreground text-xs">{fmtDate(p.week_start)} → {fmtDate(p.week_end)}</span></div>
              <div className="text-xs text-muted-foreground">{p.prize_description ?? "Sem prémio definido"}{p.hybrid_score != null ? ` · score ${fmtNum(Math.round(p.hybrid_score))}` : ""}</div>
            </div>
            <span className="rounded-sm bg-muted px-2 py-1 text-xs text-display">{p.prize_status}</span>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={() => { setEditId(p.id); setDesc(p.prize_description ?? ""); setStatus(p.prize_status); setNotes(p.notes ?? ""); }}>Editar</Button>
            )}
          </div>
        ))}
        {!prizes.isLoading && !prizes.data?.length && <p className="text-muted-foreground">Sem prémios.</p>}
      </div>
      <Dialog open={editId != null} onOpenChange={(v) => !v && setEditId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar prémio</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><label className="text-xs text-muted-foreground">Descrição</label><Input value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
            <div><label className="text-xs text-muted-foreground">Status</label>
              <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["por_definir", "definido", "entregue", "cancelado", "alterado"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
            <div><label className="text-xs text-muted-foreground">Notas</label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditId(null)}>Cancelar</Button>
            <Button onClick={() => m.mutate()} disabled={m.isPending}>{m.isPending ? "…" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
