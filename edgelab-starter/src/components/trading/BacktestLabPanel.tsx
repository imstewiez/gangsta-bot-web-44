import { useEffect, useState } from "react";
import { Activity, Play, RefreshCw, ShieldAlert } from "lucide-react";

import { runMaCrossBacktest } from "../../lib/trading/ma-cross-backtest";
import { createSampleCandles } from "../../lib/trading/sample-data";
import type { BacktestOutput } from "../../lib/trading/backtest-types";
import { listDatasets, loadDatasetCandles, type SavedDataset } from "../../lib/trading/datasets.client";

export function BacktestLabPanel() {
  const [datasets, setDatasets] = useState<SavedDataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState("sample");
  const [loadingDatasets, setLoadingDatasets] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestOutput | null>(null);

  async function refreshDatasets() {
    setLoadingDatasets(true);
    setError(null);
    try {
      setDatasets(await listDatasets());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load datasets");
    } finally {
      setLoadingDatasets(false);
    }
  }

  useEffect(() => {
    refreshDatasets();
  }, []);

  async function runBacktest() {
    setRunning(true);
    setError(null);

    try {
      const candles = selectedDatasetId === "sample" ? createSampleCandles() : await loadDatasetCandles(selectedDatasetId);
      const next = runMaCrossBacktest(
        candles,
        { fastPeriod: 20, slowPeriod: 50, direction: "both" },
        { startingBalance: 10000, stakePercent: 10, costPerOrder: 2 }
      );
      setResult(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run backtest");
    } finally {
      setRunning(false);
    }
  }

  const selectedDataset = datasets.find((dataset) => dataset.id === selectedDatasetId);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <section className="card-frame rounded-3xl p-5">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
            <Activity className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-display text-lg font-bold">Backtest runner</h2>
            <p className="text-sm text-muted-foreground">Run the first MA cross simulation.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border/40 bg-background/30 p-4 text-sm text-muted-foreground">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-semibold text-foreground">Dataset</p>
            <button onClick={refreshDatasets} disabled={loadingDatasets} className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-primary disabled:opacity-40">
              <RefreshCw className={loadingDatasets ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              Refresh
            </button>
          </div>

          <select value={selectedDatasetId} onChange={(event) => setSelectedDatasetId(event.target.value)} className="w-full rounded-2xl border border-border/50 bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary">
            <option value="sample">Sample generated candles</option>
            {datasets.map((dataset) => (
              <option key={dataset.id} value={dataset.id}>{dataset.name} · {dataset.symbol} · {dataset.timeframe}</option>
            ))}
          </select>

          <div className="mt-4 space-y-1">
            <p>Strategy: MA Cross 20 / 50</p>
            <p>Starting balance: 10,000</p>
            <p>Stake size: 10% of balance</p>
            <p>Cost per order: 2</p>
            {selectedDataset && <p>Selected candles: {selectedDataset.row_count}</p>}
          </div>
        </div>

        <button onClick={runBacktest} disabled={running} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">
          <Play className="h-4 w-4" />
          {running ? "Running..." : "Run backtest"}
        </button>

        {error && <div className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

        <div className="mt-5 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <ShieldAlert className="h-4 w-4" />
            Backtest disclaimer
          </div>
          <p>Backtests are historical simulations and do not guarantee future results.</p>
        </div>
      </section>

      <section className="card-frame rounded-3xl p-5">
        <h2 className="text-display text-lg font-bold">Report preview</h2>
        {!result ? (
          <div className="mt-5 rounded-2xl border border-border/40 bg-background/30 p-6 text-sm text-muted-foreground">
            Select a dataset and run the backtest to preview metrics and orders.
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Metric label="Net result" value={formatMoney(result.stats.netResult)} />
              <Metric label="End balance" value={formatMoney(result.stats.endBalance)} />
              <Metric label="Orders" value={`${result.stats.totalOrders}`} />
              <Metric label="Success rate" value={`${result.stats.successRate.toFixed(1)}%`} />
              <Metric label="Max DD" value={formatMoney(result.stats.largestDrawdown)} />
              <Metric label="Max DD %" value={`${result.stats.largestDrawdownPercent.toFixed(2)}%`} />
            </div>

            <div className="rounded-2xl border border-border/40 bg-background/30 p-4">
              <p className="mb-3 text-sm font-semibold">Latest orders</p>
              <div className="max-h-64 overflow-y-auto text-sm">
                {result.orders.length === 0 && <p className="text-muted-foreground">No orders were generated by this strategy.</p>}
                {result.orders.slice(-10).map((order, index) => (
                  <div key={`${order.entryTime}-${index}`} className="grid grid-cols-[1fr_auto_auto] gap-3 border-b border-border/20 py-2 last:border-b-0">
                    <span className="truncate text-muted-foreground">{order.side} @ {order.entryPrice.toFixed(2)}</span>
                    <span>{formatMoney(order.result)}</span>
                    <span className="text-muted-foreground">{order.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-background/30 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(value);
}
