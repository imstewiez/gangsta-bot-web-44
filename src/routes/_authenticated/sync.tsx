import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listRecentWeeks, recomputeWeek } from "@/lib/rankings.functions";
import { listSheetSyncState, requestSheetResync } from "@/lib/sheets.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { fmtDate } from "@/lib/domain";
import { toast } from "sonner";
import { RefreshCw, Sheet, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/sync")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
  },
  component: Page,
});

function Page() {
  const weeksFn = useServerFn(listRecentWeeks);
  const recomputeFn = useServerFn(recomputeWeek);
  const sheetsFn = useServerFn(listSheetSyncState);
  const resyncFn = useServerFn(requestSheetResync);
  const qc = useQueryClient();

  const weeks = useQuery({ queryKey: ["sync:weeks"], queryFn: () => weeksFn() });
  const sheets = useQuery({ queryKey: ["sync:sheets"], queryFn: () => sheetsFn() });

  const recompute = useMutation({
    mutationFn: (week_start: string | null) => recomputeFn({ data: { week_start } }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["sync:weeks"] });
      qc.invalidateQueries({ queryKey: ["weekly"] });
      toast.success(`Rankings recomputados (${r.rows_written} membros)`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resync = useMutation({
    mutationFn: (tab_key: string) => resyncFn({ data: { tab_key } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sync:sheets"] }); toast.success("Marcado para re-sync"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader eyebrow="Manutenção" title="Sincronizações"
        description="Recomputa rankings semanais e força re-sync das tabs do Sheets."
      />

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-display text-sm flex items-center gap-2"><Trophy className="h-4 w-4 text-primary" />Rankings semanais</h2>
          <Button size="sm" onClick={() => recompute.mutate(null)} disabled={recompute.isPending}>
            <RefreshCw className="mr-1 h-4 w-4" />Recomputar semana atual
          </Button>
        </div>
        <div className="space-y-2">
          {weeks.isLoading && <p className="text-muted-foreground">A carregar…</p>}
          {(weeks.data ?? []).map((w) => (
            <div key={w.week_start} className="flex items-center gap-4 rounded-sm border border-border bg-card p-3 text-sm">
              <div className="flex-1">
                <div className="text-display text-xs">{fmtDate(w.week_start)} → {fmtDate(w.week_end)}</div>
                <div className="text-xs text-muted-foreground">{w.rows} membros · último write {w.last_recomputed_at ? fmtDate(w.last_recomputed_at) : "—"}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => recompute.mutate(w.week_start)} disabled={recompute.isPending}>
                Re-computar
              </Button>
            </div>
          ))}
          {!weeks.isLoading && !weeks.data?.length && <p className="text-muted-foreground">Sem semanas.</p>}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-display text-sm flex items-center gap-2"><Sheet className="h-4 w-4 text-primary" />Google Sheets</h2>
          <span className="text-xs text-muted-foreground">A escrita real é feita pelo worker do bot</span>
        </div>
        <div className="space-y-2">
          {sheets.isLoading && <p className="text-muted-foreground">A carregar…</p>}
          {(sheets.data ?? []).map((s) => {
            const ok = s.last_result === "ok" || s.last_result === "success" || s.last_result === "no_change";
            return (
              <div key={s.tab_key} className="flex items-center gap-4 rounded-sm border border-border bg-card p-3 text-sm">
                <div className="flex-1">
                  <div className="text-display text-xs">{s.tab_key}</div>
                  <div className="text-xs text-muted-foreground">
                    Última: {s.last_synced_at ? fmtDate(s.last_synced_at) : "nunca"} · {s.last_ms ?? "?"} ms · {s.last_ops ?? 0} ops
                    {s.last_error ? ` · err: ${s.last_error.slice(0, 40)}` : ""}
                  </div>
                </div>
                <span className={"rounded-sm px-2 py-1 text-xs text-display " + (ok ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300")}>
                  {s.last_result ?? "—"}
                </span>
                <Button size="sm" variant="outline" onClick={() => resync.mutate(s.tab_key)} disabled={resync.isPending}>
                  Forçar
                </Button>
              </div>
            );
          })}
          {!sheets.isLoading && !sheets.data?.length && <p className="text-muted-foreground">Sem state de sync registado.</p>}
        </div>
      </section>
    </>
  );
}
