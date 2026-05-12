import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSaidas } from "@/lib/operations.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { fmtDate } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/operacoes")({ component: Page });

const STATUS_COLOR: Record<string, string> = {
  planeada: "bg-muted text-muted-foreground",
  em_curso: "bg-warning/20 text-warning",
  em_liquidacao: "bg-primary/20 text-primary",
  fechada: "bg-success/20 text-success",
};

function Page() {
  const fn = useServerFn(listSaidas);
  const { data, isLoading } = useQuery({ queryKey: ["saidas"], queryFn: () => fn() });
  return (
    <>
      <PageHeader eyebrow="PvP" title="Operações / Saídas" description={`${data?.length ?? 0} registos.`} />
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
