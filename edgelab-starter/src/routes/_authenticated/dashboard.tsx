import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, DatabaseZap, FlaskConical, Gauge, BrainCircuit } from "lucide-react";

import { EdgeLabPageHeader } from "../../components/layout/EdgeLabShell";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardRoute,
});

function DashboardRoute() {
  return (
    <>
      <EdgeLabPageHeader
        eyebrow="Research cockpit"
        title="Dashboard"
        description="Your starting point for market data, strategies and backtest research."
        icon={Gauge}
      />

      <div className="grid gap-5 md:grid-cols-3">
        <MetricCard label="Datasets" value="0" note="CSV import comes first" />
        <MetricCard label="Strategies" value="1" note="MA Cross starter" />
        <MetricCard label="Backtests" value="1" note="Sample runner ready" />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <ActionCard to="/data-import" icon={DatabaseZap} title="Import data" description="Upload OHLC candle data and validate the dataset." />
        <ActionCard to="/strategies" icon={BrainCircuit} title="Build strategy" description="Create the first deterministic MA Cross strategy." />
        <ActionCard to="/backtests" icon={FlaskConical} title="Run backtest" description="Execute the sample strategy and preview results." />
      </div>
    </>
  );
}

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="card-frame rounded-3xl p-5">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-3 text-4xl font-black text-foreground">{value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{note}</p>
    </div>
  );
}

function ActionCard({ to, icon: Icon, title, description }: { to: string; icon: React.ComponentType<{ className?: string }>; title: string; description: string }) {
  return (
    <Link to={to} className="card-frame group rounded-3xl p-5 hover:border-primary/45">
      <span className="mb-4 grid h-11 w-11 place-items-center rounded-2xl border border-primary/30 bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-display text-lg font-bold">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground group-hover:text-primary" />
      </div>
    </Link>
  );
}
