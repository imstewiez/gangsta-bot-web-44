import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { listDatasets, type SavedDataset } from "../../lib/trading/datasets.client";

export function DatasetListPanel() {
  const [datasets, setDatasets] = useState<SavedDataset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setDatasets(await listDatasets());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load datasets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <section className="card-frame rounded-3xl p-5">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-display text-lg font-bold">Saved datasets</h2>
          <p className="text-sm text-muted-foreground">Datasets available for real backtests.</p>
        </div>
        <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-2xl border border-border/50 px-3 py-2 text-sm text-muted-foreground hover:border-primary/30 hover:text-primary disabled:opacity-40">
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </button>
      </div>

      {error && <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

      {!error && datasets.length === 0 && (
        <div className="rounded-2xl border border-border/40 bg-background/30 p-6 text-sm text-muted-foreground">
          No saved datasets yet. Validate and save a CSV import to see it here.
        </div>
      )}

      {datasets.length > 0 && (
        <div className="space-y-3">
          {datasets.map((dataset) => (
            <div key={dataset.id} className="rounded-2xl border border-border/40 bg-background/30 p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">{dataset.name}</p>
                  <p className="mt-1 text-muted-foreground">{dataset.symbol} · {dataset.timeframe} · {dataset.row_count} candles</p>
                </div>
                <p className="text-xs text-muted-foreground">{new Date(dataset.created_at).toLocaleDateString()}</p>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{dataset.first_candle_at} → {dataset.last_candle_at}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
