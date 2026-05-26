import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { useState } from "react";
import {
  diagnoseDatabase,
  recalcAllTimeStats,
  recalcWeeklyRankings,
  ensureCriticalTables,
} from "@/lib/data-recovery.functions";
import { checkSuperAdminAccess } from "@/lib/admin.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { ButtonLoading } from "@/components/ui/ButtonLoading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Activity,
  Database,
  RefreshCw,
  Table,
  AlertTriangle,
  CheckCircle,
  ArrowLeft,
  BarChart3,
  Calendar,
} from "lucide-react";
import { Loader2 } from "lucide-react";
import { PageErrorBoundary } from "@/components/layout/PageErrorBoundary";
import { Reveal } from "@/components/layout/Reveal";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/recuperacao")({
  errorComponent: PageErrorBoundary,
  head: () => ({
    meta: [{ title: "Recuperação de Dados | Ballas Gang" }],
  }),
  component: RecuperacaoPage,
});

function RecuperacaoPage() {
  const superFn = useAuthedServerFn(checkSuperAdminAccess);
  const superCheck = useQuery({
    queryKey: ["superAdminCheck"],
    queryFn: () => superFn(),
  });
  const diagFn = useAuthedServerFn(diagnoseDatabase);
  const recalcFn = useAuthedServerFn(recalcAllTimeStats);
  const weeklyFn = useAuthedServerFn(recalcWeeklyRankings);
  const ensureFn = useAuthedServerFn(ensureCriticalTables);
  const qc = useQueryClient();

  const diag = useQuery({
    queryKey: ["db-diagnosis"],
    queryFn: () => diagFn(),
    enabled: superCheck.data?.is_superadmin ?? false,
  });

  const recalcM = useMutation({
    mutationFn: () => recalcFn(),
    onSuccess: (res) => {
      toast.success(`all_time_stats atualizado — ${res.rows_updated} membros`);
      qc.invalidateQueries({ queryKey: ["db-diagnosis"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const weeklyM = useMutation({
    mutationFn: () => weeklyFn(),
    onSuccess: (res) => {
      toast.success(`weekly_rankings atualizado — ${res.rows_updated} registos`);
      qc.invalidateQueries({ queryKey: ["db-diagnosis"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ensureM = useMutation({
    mutationFn: () => ensureFn(),
    onSuccess: () => {
      toast.success("Tabelas críticas verificadas/criadas");
      qc.invalidateQueries({ queryKey: ["db-diagnosis"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (superCheck.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!superCheck.data?.is_superadmin) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold">Acesso restrito</p>
          <p className="text-sm text-muted-foreground">
            Apenas superadmin pode aceder à recuperação de dados.
          </p>
        </div>
      </div>
    );
  }

  const healthyCount = diag.data?.filter((d) => d.healthy).length ?? 0;
  const totalCount = diag.data?.length ?? 0;

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Recuperação de Dados"
        description="Diagnóstico e reparação da base de dados"
        icon={Database}
      />

      <div className="mb-4">
        <Link
          to="/admin"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar às definições
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Reveal direction="up" delay={0}>
          <Card className="interactive-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-display text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Estado Geral
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {healthyCount}/{totalCount}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                tabelas saudáveis
              </p>
              {healthyCount < totalCount && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {totalCount - healthyCount} tabela(s) em falta ou vazia
                </div>
              )}
            </CardContent>
          </Card>
        </Reveal>

        <Reveal direction="up" delay={100}>
          <Card className="interactive-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-display text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-info" />
                all_time_stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {diag.data?.find((d) => d.table_name === "all_time_stats")?.row_count ?? "—"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                registos (membros com stats)
              </p>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal direction="up" delay={200}>
          <Card className="interactive-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-display text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4 text-warning" />
                weekly_rankings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {diag.data?.find((d) => d.table_name === "weekly_rankings")?.row_count ?? "—"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                registos de rankings
              </p>
            </CardContent>
          </Card>
        </Reveal>
      </div>

      <Reveal direction="up" delay={300}>
        <Card className="mt-4 interactive-card">
          <CardHeader>
            <CardTitle className="text-display text-sm flex items-center gap-2">
              <Table className="h-4 w-4" />
              Diagnóstico por Tabela
            </CardTitle>
          </CardHeader>
          <CardContent>
            {diag.isLoading && (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {diag.error && (
              <p className="text-destructive text-sm">
                {(diag.error as Error).message}
              </p>
            )}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {diag.data?.map((t) => (
                <div
                  key={t.table_name}
                  className={cn(
                    "flex items-center justify-between rounded-sm border p-2.5",
                    t.healthy
                      ? "border-border bg-muted/20"
                      : "border-destructive/30 bg-destructive/5"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {t.healthy ? (
                      <CheckCircle className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    )}
                    <span className="text-sm font-medium">{t.table_name}</span>
                  </div>
                  <span className="text-sm font-mono text-muted-foreground">
                    {t.row_count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </Reveal>

      <Reveal direction="up" delay={400}>
        <Card className="mt-4 interactive-card">
          <CardHeader>
            <CardTitle className="text-display text-sm flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Ferramentas de Recuperação
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-sm border border-border p-3 space-y-2">
                <div className="font-medium text-sm">1. Verificar Tabelas</div>
                <p className="text-xs text-muted-foreground">
                  Cria tabelas críticas em falta (order_comments, availability, etc.)
                </p>
                <ButtonLoading
                  size="sm"
                  loading={ensureM.isPending}
                  onClick={() => ensureM.mutate()}
                  className="w-full"
                >
                  <Database className="mr-1.5 h-3.5 w-3.5" />
                  Verificar/Criar Tabelas
                </ButtonLoading>
              </div>

              <div className="rounded-sm border border-border p-3 space-y-2">
                <div className="font-medium text-sm">2. Recalcular Stats</div>
                <p className="text-xs text-muted-foreground">
                  Recalcula all_time_stats a partir de kill_logs, operations, inventory_movements e orders
                </p>
                <ButtonLoading
                  size="sm"
                  loading={recalcM.isPending}
                  onClick={() => recalcM.mutate()}
                  className="w-full"
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Recalcular Stats
                </ButtonLoading>
              </div>

              <div className="rounded-sm border border-border p-3 space-y-2">
                <div className="font-medium text-sm">3. Recalcular Rankings</div>
                <p className="text-xs text-muted-foreground">
                  Recalcula weekly_rankings para as últimas semanas
                </p>
                <ButtonLoading
                  size="sm"
                  loading={weeklyM.isPending}
                  onClick={() => weeklyM.mutate()}
                  className="w-full"
                >
                  <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
                  Recalcular Rankings
                </ButtonLoading>
              </div>
            </div>

            <div className="mt-4 rounded-sm border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400">
              <AlertTriangle className="inline h-3.5 w-3.5 mr-1" />
              <strong>Atenção:</strong> As operações de recálculo podem demorar alguns segundos.
              Não saias da página até ver a confirmação.
            </div>
          </CardContent>
        </Card>
      </Reveal>
    </>
  );
}
