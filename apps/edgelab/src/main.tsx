import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type View = "dashboard" | "import" | "strategy" | "backtest" | "settings";

type Candle = { timestamp: string; open: number; high: number; low: number; close: number; volume?: number | null };
type Order = { side: "long" | "short"; entry: number; exit: number; result: number; reason: string };
type Backtest = { endBalance: number; net: number; orders: Order[]; winRate: number; maxDrawdown: number };

function App() {
  const [view, setView] = useState<View>("dashboard");
  const [dataset, setDataset] = useState<Candle[]>(sampleCandles());
  const [strategy, setStrategy] = useState({ name: "MA Cross Baseline", fast: 20, slow: 50, direction: "both" });
  const [backtest, setBacktest] = useState<Backtest | null>(null);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-mark">E</div>
          <div>
            <div className="logo-title">EdgeLab</div>
            <div className="logo-subtitle">Trading research cockpit</div>
          </div>
        </div>
        <nav className="nav">
          <NavButton id="dashboard" view={view} setView={setView}>Dashboard</NavButton>
          <NavButton id="import" view={view} setView={setView}>Data Import</NavButton>
          <NavButton id="strategy" view={view} setView={setView}>Strategies</NavButton>
          <NavButton id="backtest" view={view} setView={setView}>Backtests</NavButton>
          <NavButton id="settings" view={view} setView={setView}>Settings</NavButton>
        </nav>
        <div className="alert warning" style={{ marginTop: 22 }}>Backtests are simulations and do not guarantee future results.</div>
      </aside>

      <main className="main">
        <div className="topbar">
          <div>
            <div className="kicker">EdgeLab Preview</div>
            <div className="muted">Standalone preview target, isolated from Ballas production.</div>
          </div>
          <div className="version">v0.1</div>
        </div>

        <div className="content">
          {view === "dashboard" && <Dashboard dataset={dataset} backtest={backtest} setView={setView} />}
          {view === "import" && <ImportView setDataset={setDataset} />}
          {view === "strategy" && <StrategyView strategy={strategy} setStrategy={setStrategy} />}
          {view === "backtest" && <BacktestView dataset={dataset} strategy={strategy} backtest={backtest} setBacktest={setBacktest} />}
          {view === "settings" && <SettingsView />}
        </div>
      </main>
    </div>
  );
}

function NavButton({ id, view, setView, children }: { id: View; view: View; setView: (view: View) => void; children: React.ReactNode }) {
  return <button className={view === id ? "active" : ""} onClick={() => setView(id)}>{children}</button>;
}

function Dashboard({ dataset, backtest, setView }: { dataset: Candle[]; backtest: Backtest | null; setView: (view: View) => void }) {
  return (
    <div className="grid">
      <header>
        <div className="kicker">Research cockpit</div>
        <h1>Dashboard</h1>
        <p className="muted">Import data, define a strategy and run your first deterministic backtest.</p>
      </header>
      <div className="grid cols-3">
        <Metric label="Loaded candles" value={String(dataset.length)} />
        <Metric label="Latest orders" value={String(backtest?.orders.length ?? 0)} />
        <Metric label="Latest net" value={backtest ? format(backtest.net) : "—"} />
      </div>
      <div className="grid cols-3">
        <Action title="Import Data" text="Load OHLC CSV or use the included sample candles." onClick={() => setView("import")} />
        <Action title="Build Strategy" text="Tune the MA Cross parameters." onClick={() => setView("strategy")} />
        <Action title="Run Backtest" text="Execute against the active dataset." onClick={() => setView("backtest")} />
      </div>
    </div>
  );
}

function ImportView({ setDataset }: { setDataset: (rows: Candle[]) => void }) {
  const [message, setMessage] = useState("Sample data is loaded by default. CSV upload will be hardened next.");
  return (
    <div className="grid">
      <header><div className="kicker">Market data</div><h1>Data Import</h1><p className="muted">First preview supports sample data and simple CSV replacement.</p></header>
      <div className="card grid">
        <h2>CSV import preview</h2>
        <input type="file" accept=".csv,text/csv" onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          const raw = await file.text();
          const rows = parseCsv(raw);
          if (rows.length < 10) { setMessage("CSV parsed, but not enough valid candles were detected."); return; }
          setDataset(rows);
          setMessage(`Loaded ${rows.length} candles from ${file.name}.`);
        }} />
        <div className="alert success">{message}</div>
      </div>
    </div>
  );
}

function StrategyView({ strategy, setStrategy }: { strategy: { name: string; fast: number; slow: number; direction: string }; setStrategy: (s: any) => void }) {
  return (
    <div className="grid">
      <header><div className="kicker">Strategy lab</div><h1>Strategies</h1><p className="muted">Configure the first MA Cross strategy.</p></header>
      <div className="card grid cols-2">
        <label className="field"><span>Name</span><input value={strategy.name} onChange={e => setStrategy({ ...strategy, name: e.target.value })} /></label>
        <label className="field"><span>Direction</span><select value={strategy.direction} onChange={e => setStrategy({ ...strategy, direction: e.target.value })}><option value="both">Long and short</option><option value="long">Long only</option><option value="short">Short only</option></select></label>
        <label className="field"><span>Fast MA</span><input type="number" value={strategy.fast} onChange={e => setStrategy({ ...strategy, fast: Number(e.target.value) })} /></label>
        <label className="field"><span>Slow MA</span><input type="number" value={strategy.slow} onChange={e => setStrategy({ ...strategy, slow: Number(e.target.value) })} /></label>
      </div>
      {strategy.fast >= strategy.slow && <div className="alert warning">Fast MA should normally be lower than Slow MA.</div>}
    </div>
  );
}

function BacktestView({ dataset, strategy, backtest, setBacktest }: { dataset: Candle[]; strategy: any; backtest: Backtest | null; setBacktest: (b: Backtest) => void }) {
  return (
    <div className="grid">
      <header><div className="kicker">Backtest lab</div><h1>Backtests</h1><p className="muted">Run the configured MA Cross strategy against the active dataset.</p></header>
      <div className="card grid">
        <h2>Run setup</h2>
        <p className="muted">Dataset: {dataset.length} candles · Strategy: {strategy.name} · MA {strategy.fast}/{strategy.slow}</p>
        <button className="primary" onClick={() => setBacktest(runBacktest(dataset, strategy))}>Run backtest</button>
      </div>
      {backtest && <Report backtest={backtest} />}
    </div>
  );
}

function Report({ backtest }: { backtest: Backtest }) {
  return (
    <div className="card grid">
      <h2>Report preview</h2>
      <div className="grid cols-3">
        <Metric label="End balance" value={format(backtest.endBalance)} />
        <Metric label="Net result" value={format(backtest.net)} />
        <Metric label="Win rate" value={`${backtest.winRate.toFixed(1)}%`} />
      </div>
      <div className="table">
        {backtest.orders.slice(-8).map((order, i) => <div className="row" key={i}><span>{order.side} {order.entry.toFixed(2)} → {order.exit.toFixed(2)}</span><strong>{format(order.result)}</strong><span className="muted">{order.reason}</span></div>)}
      </div>
    </div>
  );
}

function SettingsView() {
  return <div className="grid"><header><div className="kicker">Workspace</div><h1>Settings</h1><p className="muted">Preview settings are local only. Supabase save comes after the preview deploy is verified.</p></header><div className="card"><p>Default balance: 10,000</p><p>Default stake: 10%</p><p>Order cost: 2</p></div></div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="metric"><div className="metric-label">{label}</div><div className="metric-value">{value}</div></div>; }
function Action({ title, text, onClick }: { title: string; text: string; onClick: () => void }) { return <button className="card" onClick={onClick} style={{ textAlign: "left", cursor: "pointer" }}><h2>{title}</h2><p className="muted">{text}</p></button>; }

function sampleCandles(): Candle[] {
  const rows: Candle[] = []; let price = 2000; const start = Date.UTC(2025, 0, 1);
  for (let i = 0; i < 180; i++) { const close = price + Math.sin(i / 8) * 8 + i * 0.14; rows.push({ timestamp: new Date(start + i * 3600000).toISOString(), open: price, high: Math.max(price, close) + 3, low: Math.min(price, close) - 3, close }); price = close; }
  return rows;
}

function parseCsv(raw: string): Candle[] {
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean); const headers = (lines[0] ?? "").split(",").map(h => h.trim().toLowerCase());
  const idx = (names: string[]) => names.map(n => headers.indexOf(n)).find(i => i >= 0) ?? -1;
  const t = idx(["time", "timestamp", "date", "open_time"]), o = idx(["open", "o"]), h = idx(["high", "h"]), l = idx(["low", "l"]), c = idx(["close", "c"]);
  if ([t,o,h,l,c].some(i => i < 0)) return [];
  return lines.slice(1).map(line => line.split(",")).map(cols => ({ timestamp: new Date(cols[t]).toISOString(), open: Number(cols[o]), high: Number(cols[h]), low: Number(cols[l]), close: Number(cols[c]) })).filter(row => row.timestamp && Number.isFinite(row.open) && Number.isFinite(row.high) && Number.isFinite(row.low) && Number.isFinite(row.close));
}

function runBacktest(candles: Candle[], strategy: { fast: number; slow: number; direction: string }): Backtest {
  const closes = candles.map(c => c.close), fast = sma(closes, strategy.fast), slow = sma(closes, strategy.slow); let balance = 10000, peak = 10000, maxDd = 0; const orders: Order[] = []; let pos: { side: "long" | "short"; entry: number } | null = null;
  for (let i = 1; i < candles.length; i++) { const up = fast[i-1] <= slow[i-1] && fast[i] > slow[i], down = fast[i-1] >= slow[i-1] && fast[i] < slow[i]; const price = candles[i].close;
    if (pos && ((pos.side === "long" && down) || (pos.side === "short" && up) || i === candles.length - 1)) { const result = pos.side === "long" ? price - pos.entry - 2 : pos.entry - price - 2; orders.push({ side: pos.side, entry: pos.entry, exit: price, result, reason: i === candles.length - 1 ? "end" : "cross" }); balance += result; pos = null; }
    if (!pos && up && strategy.direction !== "short") pos = { side: "long", entry: price };
    if (!pos && down && strategy.direction !== "long") pos = { side: "short", entry: price };
    peak = Math.max(peak, balance); maxDd = Math.max(maxDd, peak - balance);
  }
  const wins = orders.filter(o => o.result > 0).length; return { endBalance: balance, net: balance - 10000, orders, winRate: orders.length ? wins / orders.length * 100 : 0, maxDrawdown: maxDd };
}

function sma(values: number[], period: number): number[] { return values.map((_, i) => i + 1 < period ? NaN : values.slice(i + 1 - period, i + 1).reduce((a,b) => a + b, 0) / period); }
function format(n: number) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(n); }

createRoot(document.getElementById("root")!).render(<App />);
