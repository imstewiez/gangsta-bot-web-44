import { Crosshair, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SaidaEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-card/30 py-16 px-4 text-center animate-rise">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
        <Crosshair className="h-8 w-8 text-primary/60" />
      </div>
      <h3 className="text-lg font-bold font-display">Nenhuma saída encontrada</h3>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        Nenhuma saída registada
      </p>
      <Button className="mt-5 gap-2" onClick={onCreate}>
        <Plus className="h-4 w-4" />
        Nova saída
      </Button>
    </div>
  );
}

export function SaidaEmptyFilterState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-card/30 py-12 px-4 text-center animate-rise">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
        <Crosshair className="h-6 w-6 text-muted-foreground/40" />
      </div>
      <h3 className="text-sm font-semibold">Nenhuma saída corresponde</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Ajusta os filtros ou a pesquisa
      </p>
      <Button variant="ghost" size="sm" className="mt-3 text-xs" onClick={onClear}>
        Limpar filtros
      </Button>
    </div>
  );
}
