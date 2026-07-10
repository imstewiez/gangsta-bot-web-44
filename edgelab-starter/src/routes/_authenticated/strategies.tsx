import { createFileRoute } from "@tanstack/react-router";
import { BrainCircuit } from "lucide-react";

import { EdgeLabPageHeader } from "../../components/layout/EdgeLabShell";
import { StrategyDraftForm } from "../../components/trading/StrategyDraftForm";

export const Route = createFileRoute("/_authenticated/strategies")({
  component: StrategiesRoute,
});

function StrategiesRoute() {
  return (
    <>
      <EdgeLabPageHeader
        eyebrow="Strategy lab"
        title="Strategies"
        description="Create deterministic strategy rules before running a backtest."
        icon={BrainCircuit}
      />

      <div className="mb-6 rounded-3xl border border-primary/20 bg-primary/8 p-5 text-sm text-muted-foreground">
        <p>
          Build deterministic strategy rules before running a backtest. v0.1 starts with a simple moving-average cross strategy.
        </p>
      </div>

      <StrategyDraftForm />
    </>
  );
}
