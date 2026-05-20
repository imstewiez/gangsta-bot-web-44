import { useState } from "react";
import { cn } from "@/lib/utils";
import { Search, Filter, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export type SaidaFilter = {
  status: string | null;
  search: string;
  dateFrom: string;
  dateTo: string;
};

const STATUS_TABS = [
  { key: null, label: "Todas" },
  { key: "criada", label: "Plan" },
  { key: "em_curso", label: "Em curso" },
  { key: "fechadas", label: "Fechadas" },
];

export function SaidaFilters({
  filter,
  onChange,
  counts,
}: {
  filter: SaidaFilter;
  onChange: (f: SaidaFilter) => void;
  counts: Record<string, number>;
}) {
  const [showDateFilter, setShowDateFilter] = useState(false);

  return (
    <div className="space-y-3">
      {/* Status tabs */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((tab) => {
          const isActive = filter.status === tab.key;
          const count = tab.key ? counts[tab.key] ?? 0 : Object.values(counts).reduce((a, b) => a + b, 0);
          return (
            <button
              key={tab.label}
              onClick={() => onChange({ ...filter, status: tab.key })}
              className={cn(
                "relative flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-medium transition-all",
                isActive
                  ? "border-primary/50 bg-primary/15 text-primary shadow-[0_0_12px_-4px_rgba(168,85,247,0.3)]"
                  : "border-border/60 bg-card/40 text-muted-foreground hover:bg-card/80 hover:text-foreground",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0 text-[10px]",
                  isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground/70",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search + Date filter toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            placeholder="Procurar por spot, tipo ou ID..."
            value={filter.search}
            onChange={(e) => onChange({ ...filter, search: e.target.value })}
            className="h-9 pl-9 text-sm"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 gap-1.5",
            showDateFilter && "border-primary/50 bg-primary/10 text-primary",
          )}
          onClick={() => setShowDateFilter(!showDateFilter)}
        >
          <Calendar className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Data</span>
        </Button>
      </div>

      {/* Date range */}
      {showDateFilter && (
        <div className="flex gap-2 animate-rise">
          <Input
            type="date"
            value={filter.dateFrom}
            onChange={(e) => onChange({ ...filter, dateFrom: e.target.value })}
            className="h-8 text-xs"
            placeholder="De"
          />
          <span className="flex items-center text-muted-foreground/50">→</span>
          <Input
            type="date"
            value={filter.dateTo}
            onChange={(e) => onChange({ ...filter, dateTo: e.target.value })}
            className="h-8 text-xs"
            placeholder="Até"
          />
          {(filter.dateFrom || filter.dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => onChange({ ...filter, dateFrom: "", dateTo: "" })}
            >
              Limpar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function filterSaidas<T extends { tipo: string | null; spot: string | null; status: string; scheduled_at: string | null; id: number }>(
  saidas: T[],
  filter: SaidaFilter,
): T[] {
  return saidas.filter((s) => {
    if (filter.status) {
      if (filter.status === "fechadas") {
        if (!["concluida", "cancelada"].includes(s.status)) return false;
      } else if (s.status !== filter.status) {
        return false;
      }
    }
    if (filter.search) {
      const q = filter.search.toLowerCase();
      const matches =
        (s.spot ?? "").toLowerCase().includes(q) ||
        (s.tipo ?? "").toLowerCase().includes(q) ||
        String(s.id).includes(q);
      if (!matches) return false;
    }
    if (filter.dateFrom && s.scheduled_at) {
      if (new Date(s.scheduled_at) < new Date(filter.dateFrom)) return false;
    }
    if (filter.dateTo && s.scheduled_at) {
      if (new Date(s.scheduled_at) > new Date(filter.dateTo + "T23:59:59")) return false;
    }
    return true;
  });
}
