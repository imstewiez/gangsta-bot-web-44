import { useMemo, useState } from "react";
import { Upload, CheckCircle2, AlertTriangle } from "lucide-react";

import { getCsvHeaders } from "../../lib/trading/simple-csv";
import { importMarketData, type MarketColumnMap } from "../../lib/trading/import-market-data";
import type { MarketCandle } from "../../lib/trading/market-data";

type ImportState = {
  fileName: string;
  raw: string;
  headers: string[];
};

const defaultMap: MarketColumnMap = {
  time: "time",
  open: "open",
  high: "high",
  low: "low",
  close: "close",
  volume: "volume",
};

export function DataImportPanel() {
  const [importState, setImportState] = useState<ImportState | null>(null);
  const [map, setMap] = useState<MarketColumnMap>(defaultMap);
  const [candles, setCandles] = useState<MarketCandle[]>([]);
  const [issues, setIssues] = useState<Array<{ row: number; message: string }>>([]);

  const canValidate = Boolean(importState?.raw && map.time && map.open && map.high && map.low && map.close);

  const summary = useMemo(() => {
    if (!candles.length) return null;
    return {
      rows: candles.length,
      first: candles[0]?.timestamp,
      last: candles[candles.length - 1]?.timestamp,
    };
  }, [candles]);

  async function onFileChange(file: File | null) {
    if (!file) return;
    const raw = await file.text();
    const headers = getCsvHeaders(raw);
    const smartMap = guessColumnMap(headers);
    setImportState({ fileName: file.name, raw, headers });
    setMap(smartMap);
    setCandles([]);
    setIssues([]);
  }

  function validate() {
    if (!importState) return;
    const result = importMarketData(importState.raw, map);
    setCandles(result.candles);
    setIssues(result.issues);
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <section className="card-frame rounded-3xl p-5">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
            <Upload className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-display text-lg font-bold">Import market data</h2>
            <p className="text-sm text-muted-foreground">Upload OHLC candle data from CSV.</p>
          </div>
        </div>

        <label className="block cursor-pointer rounded-3xl border border-dashed border-primary/35 bg-primary/5 p-8 text-center hover:bg-primary/10">
          <input className="hidden" type="file" accept=".csv,text/csv" onChange={(event) => onFileChange(event.target.files?.[0] ?? null)} />
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-background/50 text-primary">
            <Upload className="h-6 w-6" />
          </div>
          <p className="text-display text-sm font-semibold">Drop or select CSV</p>
          <p className="mt-1 text-xs text-muted-foreground">Required: time, open, high, low, close.</p>
        </label>

        {importState && (
          <div className="mt-5 rounded-2xl border border-border/40 bg-background/30 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Selected file</p>
            <p className="mt-1 truncate font-semibold">{importState.fileName}</p>
            <p className="mt-2 text-sm text-muted-foreground">Detected {importState.headers.length} columns.</p>
          </div>
        )}
      </section>

      <section className="card-frame rounded-3xl p-5">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-display text-lg font-bold">Column mapping</h2>
            <p className="text-sm text-muted-foreground">Match your CSV columns to the candle model.</p>
          </div>
          <button disabled={!canValidate} onClick={validate} className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">
            Validate
          </button>
        </div>

        {!importState ? (
          <div className="rounded-2xl border border-border/40 bg-background/30 p-6 text-sm text-muted-foreground">Upload a CSV file to start mapping columns.</div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <ColumnSelect label="Time" value={map.time} headers={importState.headers} onChange={(value) => setMap({ ...map, time: value })} />
            <ColumnSelect label="Open" value={map.open} headers={importState.headers} onChange={(value) => setMap({ ...map, open: value })} />
            <ColumnSelect label="High" value={map.high} headers={importState.headers} onChange={(value) => setMap({ ...map, high: value })} />
            <ColumnSelect label="Low" value={map.low} headers={importState.headers} onChange={(value) => setMap({ ...map, low: value })} />
            <ColumnSelect label="Close" value={map.close} headers={importState.headers} onChange={(value) => setMap({ ...map, close: value })} />
            <ColumnSelect label="Volume" value={map.volume ?? ""} headers={["", ...importState.headers]} onChange={(value) => setMap({ ...map, volume: value || undefined })} />
          </div>
        )}

        {summary && (
          <div className="mt-5 rounded-2xl border border-success/30 bg-success/10 p-4 text-sm">
            <div className="mb-2 flex items-center gap-2 font-semibold text-success">
              <CheckCircle2 className="h-4 w-4" />
              Import validation passed with {summary.rows} valid candles.
            </div>
            <p className="text-muted-foreground">First candle: {summary.first}</p>
            <p className="text-muted-foreground">Last candle: {summary.last}</p>
          </div>
        )}

        {issues.length > 0 && (
          <div className="mt-5 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm">
            <div className="mb-2 flex items-center gap-2 font-semibold text-warning">
              <AlertTriangle className="h-4 w-4" />
              {issues.length} validation issue(s)
            </div>
            <div className="max-h-40 space-y-1 overflow-y-auto text-muted-foreground">
              {issues.slice(0, 20).map((issue, index) => (
                <p key={`${issue.row}-${index}`}>Row {issue.row}: {issue.message}</p>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function ColumnSelect({ label, value, headers, onChange }: { label: string; value: string; headers: string[]; onChange: (value: string) => void }) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-2xl border border-border/50 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary">
        {headers.map((header) => (
          <option key={header || "none"} value={header}>{header || "None"}</option>
        ))}
      </select>
    </label>
  );
}

function guessColumnMap(headers: string[]): MarketColumnMap {
  const lower = new Map(headers.map((header) => [header.toLowerCase(), header]));
  const pick = (...names: string[]) => names.map((name) => lower.get(name)).find(Boolean) ?? "";

  return {
    time: pick("time", "timestamp", "date", "open_time"),
    open: pick("open", "o"),
    high: pick("high", "h"),
    low: pick("low", "l"),
    close: pick("close", "c"),
    volume: pick("volume", "vol", "v") || undefined,
  };
}
