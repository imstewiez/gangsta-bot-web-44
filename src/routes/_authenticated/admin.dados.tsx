import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageErrorBoundary } from "@/components/layout/PageErrorBoundary";
import { getDataQualityReport, repairDeliveryLines, type DataQualityCheck, type DataQualitySeverity } from "@/lib/data-quality-v2.functions";
import { AlertTriangle, CheckCircle2, Database, Loader2, RefreshCw, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { beautifyError } from "@/lib/messages";

export const Route = createFileRoute("/_authenticated/admin/dados")({
  errorComponent: PageErrorBoundary,
  head: () => ({ meta: [{ title: "Qualidade de Dados | Ballas Gang" }] }),
  component: DataQualityPage,
});

const severityLabel: Record<DataQualitySeverity, string> = { critical: "Crítico", high: "Alto", medium: "Médio", low: "Baixo" };
const severityClass: Record<DataQualitySeverity, string> = {
  critical: "border-red-500/40 bg-red-500/10 text-red-400",
  high: "border-orange-500/40 bg-orange-500/10 text-orange-400",
  medium: "border-amber-500/40 bg-amber-500/10 text-amber-400",
  low: "border-blue-500/40 bg-blue-500/10 text-blue-400",
};

function DataQualityPage() {
  const reportFn = useAuthedServerFn(getDataQualityReport);
  const repairFn = useAuthedServerFn(repairDeliveryLines);
  const qc = useQueryClient();
  const report = useQuery({ queryKey: ["dataQualityReport"], queryFn: () => reportFn(), staleTime: 30_000 });

  const repair = useMutation({
    mutationFn: () => repairFn(),
    onSuccess: (result) => {
      toast.success(`Reparação concluída: ${result.repaired} pedido(s) normalizado(s), ${result.rejected} rejeitado(s).`);
      qc.invalidateQueries({ queryKey: ["dataQualityReport"] });
      qc.invalidateQueries({ queryKey: ["deliveries"] });
    },
    onError: (e: Error) => toast.error(beautifyError(e)),
  });

  const summary = report.data?.summary;
  const hasIssues = (summary?.total_issues ?? 0) > 0;

  return (
    <>
      <PageHeader
        eyebrow="Chefia"
        title="Qualidade de Dados"
        description="Auditoria central para recolha, limpeza, tratamento e exposição dos dados do sistema."
        icon={Database}
        action={
          <Button size="sm" variant="outline" onClick={() => report.refetch()} disabled={report.isFetching}>
            {report.isFetching ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
            Reanalisar
          </Button>
        }
      />

      {report.isLoading && <div className="flex h-48 items-center justify-center gap-3 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" />A analisar dados...</div>}

      {summary && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MetricCard label="Estado" value={hasIssues ? "Atenção" : "OK"} tone={hasIssues ? "bad" : "good"} />
            <MetricCard label="Problemas" value={summary.total_issues} tone={hasIssues ? "bad" : "good"} />
            <MetricCard label="Críticos" value={summary.critical} tone={summary.critical > 0 ? "bad" : "good"} />
            <MetricCard label="Altos" value={summary.high} tone={summary.high > 0 ? "warn" : "good"} />
            <MetricCard label="Checks" value={summary.total_checks} />
          </div>

          <Card className="border-border/60 bg-card/70">
            <CardHeader><CardTitle className="text-display text-sm flex items-center gap-2">{hasIssues ? <AlertTriangle className="h-4 w-4 text-amber-400" /> : <CheckCircle2 className="h-4 w-4 text-emerald-400" />}Resultado da auditoria</CardTitle></CardHeader>
            <CardContent><div className="space-y-3">{report.data.checks.map((check) => <CheckRow key={check.id} check={check} onRepair={check.repair_action === "repair_delivery_lines" ? () => repair.mutate() : undefined} repairing={repair.isPending} />)}</div></CardContent>
          </Card>
        </div>
      )}
    </>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "warn" | "bad" }) {
  return <Card className={cn("border-border/60 bg-card/70", tone === "good" && "border-emerald-500/20", tone === "warn" && "border-amber-500/20", tone === "bad" && "border-red-500/25")}><CardContent className="p-4"><div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</div><div className={cn("mt-1 text-2xl font-bold font-display", tone === "good" && "text-emerald-400", tone === "warn" && "text-amber-400", tone === "bad" && "text-red-400")}>{value}</div></CardContent></Card>;
}

function CheckRow({ check, onRepair, repairing }: { check: DataQualityCheck; onRepair?: () => void; repairing?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-4 bg-background/35", check.ok ? "border-emerald-500/15" : "border-border/70")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {check.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-amber-400" />}
            <h3 className="text-sm font-semibold">{check.title}</h3>
            <Badge variant="outline" className={cn("text-[10px]", check.ok ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10" : severityClass[check.severity])}>{check.ok ? "OK" : severityLabel[check.severity]}</Badge>
            <Badge variant="outline" className="text-[10px] capitalize text-muted-foreground">{check.area}</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{check.summary}</p>
          {!check.ok && <p className="mt-2 text-xs leading-relaxed text-muted-foreground/90"><span className="font-semibold text-foreground">Ação recomendada:</span> {check.recommendation}</p>}
          {!check.ok && onRepair && <Button size="sm" className="mt-3" onClick={onRepair} disabled={repairing}>{repairing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Wrench className="mr-1 h-4 w-4" />}Reparar entregas legacy</Button>}
        </div>
        <div className={cn("min-w-14 rounded-lg border px-3 py-2 text-center font-mono text-sm", check.ok ? "border-emerald-500/20 text-emerald-400 bg-emerald-500/5" : "border-amber-500/20 text-amber-400 bg-amber-500/5")}>{check.count}</div>
      </div>
      {!check.ok && check.examples.length > 0 && <div className="mt-3 rounded-lg border border-border/50 bg-muted/20 p-3"><div className="mb-1.5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Exemplos</div><div className="space-y-1 font-mono text-xs text-muted-foreground">{check.examples.map((ex, i) => <div key={`${check.id}-${i}`} className="truncate">{ex}</div>)}</div></div>}
    </div>
  );
}
