import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { useState, useMemo } from "react";
import { listSaidas, createOperationWithParticipants } from "@/lib/operations.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SaidaCard } from "@/components/operations/SaidaCard";
import { SaidaStats } from "@/components/operations/SaidaStats";
import { SaidaFilters, filterSaidas } from "@/components/operations/SaidaFilters";
import { SaidaEmptyFilterState } from "@/components/operations/SaidaEmptyState";
import { Plus, Crosshair, Loader2 } from "lucide-react";
import redwoodLogo from "@/assets/ballas-logo.png";
import { toast } from "sonner";
import { beautifyError } from "@/lib/messages";
import { SaidaWizard } from "@/components/operations/SaidaWizard";
import { EMPTY_STATE, LOADING } from "@/lib/messages";
import type { SaidaFilter } from "@/components/operations/SaidaFilters";
import { Reveal, Stagger } from "@/components/layout/Reveal";

export const Route = createFileRoute("/_authenticated/operacoes/")({
  component: Page,
});

function Page() {
  useRealtimeSync([{ table: "operations", queryKeys: [["saidas"]] }]);
  const fn = useAuthedServerFn(listSaidas);
  const { data, isLoading } = useQuery({
    queryKey: ["saidas"],
    queryFn: () => fn(),
  });

  const [filter, setFilter] = useState<SaidaFilter>({
    status: null,
    search: "",
    dateFrom: "",
    dateTo: "",
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    return filterSaidas(data, filter);
  }, [data, filter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    data?.forEach((s) => {
      const key = ["concluida", "cancelada"].includes(s.status) ? "fechadas" : s.status;
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return counts;
  }, [data]);

  const hasFilters = filter.status || filter.search || filter.dateFrom || filter.dateTo;

  return (
    <>
      <PageHeader
        eyebrow="PvP"
        title="Operações / Saídas"
        description=""
        icon={BallasIcon}
        action={<NewSaidaButton />}
      />

      {/* Stats */}
      {data && data.length > 0 && (
        <Reveal direction="up">
          <SaidaStats saidas={data} />
        </Reveal>
      )}

      {/* Filters */}
      <Reveal direction="up" delay={100}>
        <div className="mt-6">
          <SaidaFilters
            filter={filter}
            onChange={setFilter}
            counts={statusCounts}
          />
        </div>
      </Reveal>

      {/* List */}
      <Reveal direction="up" delay={150}>
        <div className="mt-5">
          {isLoading && (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{LOADING.operations}</p>
            </div>
          )}

        {!isLoading && filtered.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((s, i) => (
              <SaidaCard key={s.id} saida={s} index={i} />
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && !hasFilters && data && data.length === 0 && (
          <div className="col-span-full text-center py-12">
            <Crosshair className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground">{EMPTY_STATE.operations.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{EMPTY_STATE.operations.description}</p>
          </div>
        )}

        {!isLoading && filtered.length === 0 && hasFilters && (
          <SaidaEmptyFilterState
            onClear={() =>
              setFilter({ status: null, search: "", dateFrom: "", dateTo: "" })
            }
          />
        )}
      </div>
      </Reveal>
    </>
  );
}

function NewSaidaButton() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nova saída</span>
        </Button>
      </DialogTrigger>
      <NewSaidaWizard onClose={() => setOpen(false)} />
    </Dialog>
  );
}

function NewSaidaWizard({ onClose }: { onClose: () => void }) {
  const createFn = useAuthedServerFn(createOperationWithParticipants);
  const qc = useQueryClient();

  const m = useMutation({
    mutationFn: (data: import("@/components/operations/SaidaWizard").WizardData) =>
      createFn({
        data: {
          operation_type: data.type,
          scheduled_at: data.when || null,
          notes: data.notes || null,
        },
      }),
    onSuccess: () => {
      toast.success("Sessão criada");
      qc.invalidateQueries({ queryKey: ["saidas"] });
      onClose();
    },
    onError: (e: Error) => toast.error(beautifyError(e)),
  });

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-primary" />
          Nova sessão
        </DialogTitle>
      </DialogHeader>
      <SaidaWizard
        onSubmit={(data) => m.mutate(data)}
        onCancel={onClose}
        isSubmitting={m.isPending}
      />
    </DialogContent>
  );
}

function BallasIcon({ className }: { className?: string }) {
  return <img src={redwoodLogo} alt="Ballas" className={className} />;
}
