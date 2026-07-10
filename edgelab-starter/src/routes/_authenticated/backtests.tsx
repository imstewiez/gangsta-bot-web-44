import { createFileRoute } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";

import { EdgeLabPageHeader } from "../../components/layout/EdgeLabShell";
import { BacktestLabPanel } from "../../components/trading/BacktestLabPanel";

export const Route = createFileRoute("/_authenticated/backtests")({
  component: BacktestsRoute,
});

function BacktestsRoute() {
  return (
    <>
      <EdgeLabPageHeader
        eyebrow="Backtest lab"
        title="Backtests"
        description="Run deterministic simulations and inspect the result before saving full reports."
        icon={FlaskConical}
      />

      <div className="mb-6 rounded-3xl border border-primary/20 bg-primary/8 p-5 text-sm text-muted-foreground">
        <p>
          Run deterministic simulations and review the result before adding database-backed reports and saved runs.
        </p>
      </div>

      <BacktestLabPanel />
    </>
  );
}
