import { Skeleton } from "@/components/ui/skeleton";

type Props = {
  rows?: number;
  cols?: number;
  /** Optional widths (Tailwind classes) per column */
  widths?: string[];
};

/**
 * Skeleton rows compatíveis com a estrutura de <table className="w-full text-sm">
 * usada nas páginas. Garante alturas consistentes e remove o "A carregar…".
 */
export function TableRowsSkeleton({ rows = 6, cols = 4, widths }: Props) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-t border-border">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-3 py-2.5">
              <Skeleton className={"h-4 " + (widths?.[c] ?? "w-24")} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Skeleton em grelha de cartões (para listas tipo Receitas). */
export function CardGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-sm border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-7 w-20" />
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-4/6" />
          </div>
          <div className="mt-4 flex items-center justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </>
  );
}
