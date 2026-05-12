import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  listUnfinalizedSaidas,
  getSaidaDetail,
  liquidateSaida,
} from "@/lib/liquidation.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { fmtDate, fmtNum } from "@/lib/domain";
import { toast } from "sonner";
import { CheckCircle2, FileSearch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/liquidacao")({
  component: Page,
});

function Page() {
  const listFn = useServerFn(listUnfinalizedSaidas);
  const detailFn = useServerFn(getSaidaDetail);
  const liqFn = useServerFn(liquidateSaida);
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<number | null>(null);

  const list = useQuery({ queryKey: ["liq:list"], queryFn: () => listFn() });
  const detail = useQuery({
    queryKey: ["liq:detail", openId],
    queryFn: () => detailFn({ data: { id: openId! } }),
    enabled: openId != null,
  });

  const liq = useMutation({
    mutationFn: (id: number) => liqFn({ data: { id } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["liq:list"] });
      qc.invalidateQueries({ queryKey: ["liq:detail"] });
      qc.invalidateQueries({ queryKey: ["saidas"] });
      toast.success(`Liquidada · Net ${fmtNum(Math.round(r.net))} €`);
      setOpenId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        eyebrow="Operações"
        title="Liquidação de saídas"
        description="Encerra a saída, calcula valores por participante a partir dos materiais e atualiza o net."
      />
      <div className="space-y-2">
        {list.isLoading && <p className="text-muted-foreground">A carregar…</p>}
        {(list.data ?? []).map((s) => (
          <div
            key={s.id}
            className="flex items-center gap-4 rounded-sm border border-border bg-card p-4"
          >
            <div className="grid h-10 w-10 place-items-center rounded-sm bg-muted text-display text-xs">
              #{s.id}
            </div>
            <div className="flex-1">
              <div className="font-medium">
                {s.operation_type ?? "Saída"} · {s.spot ?? "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                {fmtDate(s.scheduled_at)} · {s.participants} participantes ·{" "}
                {s.status}
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setOpenId(s.id)}>
              <FileSearch className="mr-1 h-4 w-4" />
              Liquidar
            </Button>
          </div>
        ))}
        {!list.isLoading && !list.data?.length && (
          <p className="text-muted-foreground">Nenhuma saída pendente.</p>
        )}
      </div>

      <Dialog open={openId != null} onOpenChange={(v) => !v && setOpenId(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Saída #{openId}</DialogTitle>
          </DialogHeader>
          {detail.isLoading && (
            <p className="text-muted-foreground">A carregar…</p>
          )}
          {detail.data && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2 rounded-sm border border-border bg-muted/30 p-3 text-xs md:grid-cols-3">
                <div>
                  Tipo:{" "}
                  <strong>{detail.data.operation.operation_type ?? "—"}</strong>
                </div>
                <div>
                  Spot: <strong>{detail.data.operation.spot ?? "—"}</strong>
                </div>
                <div>
                  Status: <strong>{detail.data.operation.status}</strong>
                </div>
                <div>
                  Fornecido:{" "}
                  {fmtNum(Math.round(detail.data.operation.supplied_value))} €
                </div>
                <div>
                  Retornado:{" "}
                  {fmtNum(Math.round(detail.data.operation.returned_value))} €
                </div>
                <div>
                  Net atual:{" "}
                  {fmtNum(Math.round(detail.data.operation.net_value))} €
                </div>
              </div>
              <div>
                <div className="text-display text-xs text-muted-foreground mb-1">
                  Participantes ({detail.data.participants.length})
                </div>
                <div className="max-h-48 overflow-auto rounded-sm border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 text-muted-foreground">
                      <tr>
                        <th className="px-2 py-1 text-left">Membro</th>
                        <th className="px-2 py-1">K/D</th>
                        <th className="px-2 py-1">Net</th>
                        <th className="px-2 py-1">Settled</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.data.participants.map((p) => (
                        <tr key={p.id} className="border-t border-border/40">
                          <td className="px-2 py-1">
                            {p.member_name ?? `#${p.member_id}`}
                          </td>
                          <td className="px-2 py-1 text-center">
                            {p.kills}/{p.deaths_count}
                          </td>
                          <td
                            className={
                              "px-2 py-1 text-center " +
                              (p.net_material_delta >= 0
                                ? "text-emerald-500"
                                : "text-red-500")
                            }
                          >
                            {fmtNum(Math.round(p.net_material_delta))} €
                          </td>
                          <td className="px-2 py-1 text-center">
                            {p.settled ? "✓" : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <div className="text-display text-xs text-muted-foreground mb-1">
                  Materiais ({detail.data.materials.length})
                </div>
                <div className="max-h-32 overflow-auto rounded-sm border border-border text-xs">
                  {detail.data.materials.map((m) => (
                    <div
                      key={m.id}
                      className="flex justify-between border-b border-border/40 px-2 py-1 last:border-0"
                    >
                      <span>{m.item_name ?? `#${m.item_id}`}</span>
                      <span className="text-muted-foreground">
                        {m.direction} · {m.quantity}
                      </span>
                    </div>
                  ))}
                  {!detail.data.materials.length && (
                    <div className="px-2 py-2 text-muted-foreground">
                      Sem materiais registados.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenId(null)}>
              Fechar
            </Button>
            <Button
              onClick={() => liq.mutate(openId!)}
              disabled={liq.isPending || !detail.data}
            >
              <CheckCircle2 className="mr-1 h-4 w-4" />
              {liq.isPending ? "A liquidar…" : "Liquidar agora"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
