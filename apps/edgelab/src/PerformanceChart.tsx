import type { EquityPoint } from "./trading.types";

export function PerformanceChart({ points }: { points: EquityPoint[] }) {
  if (points.length < 2) {
    return <div className="chart-empty">Run a backtest to generate an equity curve.</div>;
  }

  const width = 900;
  const height = 260;
  const padding = 18;
  const balances = points.map((point) => point.balance);
  const drawdowns = points.map((point) => point.drawdown);
  const minBalance = Math.min(...balances);
  const maxBalance = Math.max(...balances);
  const maxDrawdown = Math.max(...drawdowns, 1);

  const equityPath = points.map((point, index) => {
    const x = padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
    const y = scale(point.balance, minBalance, maxBalance, height - padding, padding);
    return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");

  const ddPath = points.map((point, index) => {
    const x = padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
    const y = scale(point.drawdown, 0, maxDrawdown, height - padding, height * 0.58);
    return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");

  return (
    <div className="chart-card">
      <div className="chart-head">
        <div>
          <div className="metric-label">Equity / drawdown</div>
          <h3>Performance curve</h3>
        </div>
        <div className="chart-legend">
          <span><i className="legend-equity" /> Equity</span>
          <span><i className="legend-dd" /> Drawdown</span>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Backtest equity curve">
        <defs>
          <linearGradient id="equityStroke" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="55%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#d8b4fe" />
          </linearGradient>
          <linearGradient id="drawdownStroke" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
        </defs>
        <g opacity="0.28">
          {[0.2, 0.4, 0.6, 0.8].map((ratio) => <line key={ratio} x1={padding} x2={width - padding} y1={height * ratio} y2={height * ratio} stroke="rgba(255,255,255,.14)" strokeDasharray="5 8" />)}
        </g>
        <path d={ddPath} fill="none" stroke="url(#drawdownStroke)" strokeWidth="2.4" opacity="0.68" />
        <path d={equityPath} fill="none" stroke="url(#equityStroke)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function scale(value: number, min: number, max: number, outMin: number, outMax: number) {
  if (max === min) return (outMin + outMax) / 2;
  const ratio = (value - min) / (max - min);
  return outMin + (outMax - outMin) * ratio;
}
