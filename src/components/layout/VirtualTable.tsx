import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

interface VirtualTableProps<T> {
  data: T[];
  rowHeight?: number;
  maxHeight?: number;
  renderRow: (item: T, index: number) => React.ReactNode;
  renderHeader?: () => React.ReactNode;
  emptyState?: React.ReactNode;
  loading?: boolean;
  loadingRows?: number;
}

export function VirtualTable<T>({
  data,
  rowHeight = 48,
  maxHeight = 600,
  renderRow,
  renderHeader,
  emptyState,
  loading,
  loadingRows = 5,
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 5,
  });

  if (loading) {
    return (
      <div className="rounded-sm border border-border overflow-hidden">
        {renderHeader && (
          <div className="bg-secondary text-display text-[11px] uppercase tracking-widest text-muted-foreground">
            {renderHeader()}
          </div>
        )}
        <div className="space-y-2 p-3">
          {Array.from({ length: loadingRows }).map((_, i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded-sm bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!data.length && emptyState) {
    return (
      <div className="rounded-sm border border-border overflow-hidden">
        {renderHeader && (
          <div className="bg-secondary text-display text-[11px] uppercase tracking-widest text-muted-foreground">
            {renderHeader()}
          </div>
        )}
        {emptyState}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="rounded-sm border border-border overflow-hidden"
      style={{ maxHeight, overflow: "auto" }}
    >
      {renderHeader && (
        <div className="sticky top-0 z-10 bg-secondary text-display text-[11px] uppercase tracking-widest text-muted-foreground">
          {renderHeader()}
        </div>
      )}
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {renderRow(data[virtualRow.index], virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
