import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { CheckCircle2, Lock, ShieldAlert, TrendingDown, TrendingUp } from "lucide-react";
import { dashboardCards, designRules, navigation, noticeConfig, pageCopy, productConfig, statusCards, type ViewId } from "./design.config";
import { PerformanceChart } from "./PerformanceChart";
import { defaultBacktestSettings, getDatasetQuality, parseCsv, runBacktest, sampleCandles } from "./trading.engine";
import type { Backtest, Candle, Strategy } from "./trading.types";
import "./styles.css";

function App() {
  const [view, setView] = useState<ViewId>("dashboard");
  const [dataset, setDataset] = useState<Candle[]>(sampleCandles());
  const [datasetName, setDatasetName] = useState("Generated XAU research sample");
  const [strategy, setStrategy] = useState<Strategy>({ name: "MA Cross Baseline", fast: 20, slow: 50, direction: "both" });
  const [backtest, setBacktest] = useState<Backtest | null>(null);
  const copy = pageCopy[view];
  const PageIcon = copy.icon;

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-mark">{productConfig.shortName}</div>
          <div>
            <div className="logo-title">{productConfig.name}</div>
            <div className="logo-subtitle">{productConfig.eyebrow}</div>
          </div>
        </div>

        <nav className="nav">
          {navigation.map((item) => (
            <button key={item.id} className={`${view === item.id ? "active" : ""} ${!item.enabled ? "nav-disabled" : ""}`} onClick={() => item.enabled && setView(item.id)} title={item.enabled ? item.description : "Coming soon"}>
              <span className="nav-label"><span className="nav-title">{item.label}</span><span className="nav-desc">{item.description}</span></span>
              {item.enabled ? <item.icon className="nav-icon" /> : <Lock className="nav-icon" />}
            </button>
          ))}
        </nav>

        <div className="notice alert warning"><div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}><ShieldAlert size={18} /><span>{noticeConfig.risk.text}</span></div></div>
      </aside>

      <main className="main">
        <div className="topbar reveal"><div><div className="kicker">{productConfig.name} Preview</div><div className="muted">Standalone preview target, isolated from Ballas production.</div></div><div className="version">{productConfig.version}</div></div>

        <div className="content reveal">
          <header className="page-head">
            <div className="kicker">{copy.eyebrow}</div>
            <div className="page-title-row"><span className="page-icon"><PageIcon /></span><div><h1>{copy.title}</h1><p className="muted">{copy.description}</p></div></div>
          </header>

          {view === "dashboard" && <Dashboard dataset={dataset} datasetName={datasetName} strategy={strategy} backtest={backtest} setView={setView} />}
          {view === "import" && <ImportView dataset={dataset} setDataset={setDataset} setDatasetName={setDatasetName} />}
          {view === "strategy" && <StrategyView strategy={strategy} setStrategy={setStrategy} />}
          {view === "backtest" && <BacktestView dataset={dataset} datasetName={datasetName} strategy={strategy} backtest={backtest} setBacktest={setBacktest} />}
          {view === "reports" && <ReportsView />}
          {view === "settings" && <SettingsView />}
        </div>
      </main>
    </div>
  );
}

function Dashboard({ dataset, datasetName, strategy, backtest, setView }: { dataset: Candle[]; datasetName: string; strategy: Strategy; backtest: Backtest | null; setView: (view: ViewId) => void }) {
  const quality = useMemo(() => getDatasetQuality(dataset), [dataset]);
  return (
    <div className="grid">
      <div className="grid cols-4">
        <Metric label="Active candles" value={String(quality.candles)} sub={datasetName} />
        <Metric label="Strategy model" value={`${strategy.fast}/${strategy.slow}`} sub={strategy.name} />
        <Metric label="Latest net" value={backtest ? format(backtest.net) : "—"} sub={backtest ? `${backtest.netPercent.toFixed(2)}% simulated` : "No run yet"} />
        <Metric label="Profit factor" value={backtest?.profitFactor === null ? "∞" : backtest?.profitFactor !== undefined ? backtest.profitFactor.toFixed(2) : "—"} sub="Backtest metric" />
      </div>

      <div className="grid cols-3">{dashboardCards.map((card) => <button key={card.title} className="hero-card" onClick={() => setView(card.target)} style={{ textAlign: "left", cursor: "pointer" }}><div className="liquid-content"><span className="badge"><card.icon size={14} /> {card.title}</span><h2 style={{ marginTop: 18 }}>{card.title}</h2><p className="muted">{card.text}</p></div><div className="liquid-content muted-2">Open module →</div></button>)}</div>

      {backtest && <PerformanceChart points={backtest.equity} />}
      <div className="grid cols-3">{statusCards.map((card) => <Metric key={card.label} label={card.label} value={card.value} sub={card.tone.toUpperCase()} />)}</div>
    </div>
  );
}

function ImportView({ dataset, setDataset, setDatasetName }: { dataset: Candle[]; setDataset: (rows: Candle[]) => void; setDatasetName: (name: string) => void }) {
  const [message, setMessage] = useState("Sample data is loaded by default. Upload CSV to replace the active dataset.");
  const [status, setStatus] = useState<"info" | "success" | "danger">("info");
  const quality = useMemo(() => getDatasetQuality(dataset), [dataset]);
  return (
    <div className="grid cols-2">
      <section className="panel"><div className="liquid-content grid"><span className="badge">CSV Intake</span><h2>Upload market data</h2><p className="muted">Accepted columns: time/timestamp/date/open_time, open, high, low, close. Volume is optional.</p><input type="file" accept=".csv,text/csv" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; const raw = await file.text(); const rows = parseCsv(raw); if (rows.length < 10) { setStatus("danger"); setMessage("CSV parsed, but not enough valid candles were detected."); return; } setDataset(rows); setDatasetName(file.name.replace(/\.csv$/i, "")); setStatus("success"); setMessage(`Loaded ${rows.length} candles from ${file.name}.`); }} /><div className={`alert ${status}`}>{message}</div></div></section>
      <section className="panel"><div className="liquid-content grid"><span className="badge"><CheckCircle2 size={14} /> Dataset Quality</span><h2>Current dataset</h2><div className="grid cols-2"><Metric label="Candles" value={String(quality.candles)} sub="Loaded" /><Metric label="Invalid" value={String(quality.invalidCandles)} sub="Rejected" /></div><p className="muted">{quality.firstTimestamp ?? "—"} → {quality.lastTimestamp ?? "—"}</p><Rule text="No missing timestamp/open/high/low/close columns." /><Rule text="High must be above open, close and low." /><Rule text="Low must be below open, close and high." /></div></section>
    </div>
  );
}

function StrategyView({ strategy, setStrategy }: { strategy: Strategy; setStrategy: (s: Strategy) => void }) {
  const invalid = strategy.fast >= strategy.slow;
  return (
    <div className="grid cols-2">
      <section className="panel"><div className="liquid-content grid"><span className="badge">MA Cross</span><h2>Strategy parameters</h2><label className="field"><span>Name</span><input value={strategy.name} onChange={e => setStrategy({ ...strategy, name: e.target.value })} /></label><div className="grid cols-2"><label className="field"><span>Fast MA</span><input type="number" value={strategy.fast} onChange={e => setStrategy({ ...strategy, fast: Number(e.target.value) })} /></label><label className="field"><span>Slow MA</span><input type="number" value={strategy.slow} onChange={e => setStrategy({ ...strategy, slow: Number(e.target.value) })} /></label></div><label className="field"><span>Direction</span><select value={strategy.direction} onChange={e => setStrategy({ ...strategy, direction: e.target.value as Strategy["direction"] })}><option value="both">Long and short</option><option value="long">Long only</option><option value="short">Short only</option></select></label>{invalid && <div className="alert warning">Fast MA should normally be lower than Slow MA.</div>}</div></section>
      <section className="panel"><div className="liquid-content grid"><span className="badge">Rule Preview</span><h2>{strategy.name || "Untitled strategy"}</h2><Rule text={`Long signal: MA ${strategy.fast} crosses above MA ${strategy.slow}.`} /><Rule text={`Short signal: MA ${strategy.fast} crosses below MA ${strategy.slow}.`} /><Rule text="Open positions close on the opposite cross or at the end of the dataset." /></div></section>
    </div>
  );
}

function BacktestView({ dataset, datasetName, strategy, backtest, setBacktest }: { dataset: Candle[]; datasetName: string; strategy: Strategy; backtest: Backtest | null; setBacktest: (b: Backtest) => void }) {
  return (
    <div className="grid">
      <section className="panel"><div className="liquid-content grid cols-2"><div><span className="badge">Simulation Setup</span><h2 style={{ marginTop: 14 }}>Ready to run</h2><p className="muted">Dataset: {datasetName} · {dataset.length} candles · Strategy: {strategy.name} · MA {strategy.fast}/{strategy.slow}</p><p className="muted-2">Balance {format(defaultBacktestSettings.startingBalance)} · Stake {defaultBacktestSettings.stakePercent}% · Order cost {defaultBacktestSettings.orderCost}</p></div><button className="primary" onClick={() => setBacktest(runBacktest(dataset, strategy))}>Run deterministic backtest</button></div></section>
      {backtest ? <Report backtest={backtest} /> : <div className="alert info">Run a backtest to generate the first report preview.</div>}
    </div>
  );
}

function Report({ backtest }: { backtest: Backtest }) {
  const positive = backtest.net >= 0;
  return (
    <section className="panel"><div className="liquid-content grid"><div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}><div><span className="badge">Report Preview</span><h2 style={{ marginTop: 14 }}>Latest backtest result</h2></div>{positive ? <TrendingUp color="var(--green)" /> : <TrendingDown color="var(--red)" />}</div><div className="grid cols-4"><Metric label="End balance" value={format(backtest.endBalance)} sub="Simulated" /><Metric label="Net result" value={format(backtest.net)} sub={`${backtest.netPercent.toFixed(2)}%`} /><Metric label="Win rate" value={`${backtest.winRate.toFixed(1)}%`} sub="Order based" /><Metric label="Max DD" value={`${backtest.maxDrawdownPercent.toFixed(2)}%`} sub={format(backtest.maxDrawdown)} /></div><PerformanceChart points={backtest.equity} /><div className="table">{backtest.orders.length === 0 && <div className="row"><span>No orders generated.</span><strong>—</strong><span className="muted">Check strategy</span></div>}{backtest.orders.slice(-10).map((order, i) => <div className="row" key={i}><span>{order.side.toUpperCase()} · {order.entry.toFixed(2)} → {order.exit.toFixed(2)}</span><strong>{format(order.result)}</strong><span className="muted">{order.reason}</span></div>)}</div></div></section>
  );
}

function ReportsView() { return <section className="panel"><div className="liquid-content grid"><span className="badge">Coming Soon</span><h2>Saved reports</h2><p className="muted">This module will store persistent reports once Supabase-backed runs are enabled.</p></div></section>; }
function SettingsView() { return <div className="grid cols-2"><section className="panel"><div className="liquid-content grid"><span className="badge">Defaults</span><h2>Backtest assumptions</h2><Metric label="Default balance" value="10,000" sub="Preview" /><Metric label="Default stake" value="10%" sub="Per run" /><Metric label="Order cost" value="2" sub="Flat model" /></div></section><section className="panel"><div className="liquid-content grid"><span className="badge">Design Rules</span><h2>Central standards</h2>{designRules.copyRules.map(rule => <Rule key={rule} text={rule} />)}</div></section></div>; }
function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) { return <div className="metric"><div className="metric-label">{label}</div><div className="metric-value">{value}</div>{sub && <div className="metric-sub">{sub}</div>}</div>; }
function Rule({ text }: { text: string }) { return <div className="alert info">{text}</div>; }
function format(n: number) { return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(n); }

createRoot(document.getElementById("root")!).render(<App />);
