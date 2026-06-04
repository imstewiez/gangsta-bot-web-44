import { createFileRoute } from "@tanstack/react-router";
import { DatabaseZap } from "lucide-react";

import { PageHeader } from "../../components/layout/AppShell";
import { DataImportPanel } from "../../components/trading/DataImportPanel";

export const Route = createFileRoute("/_authenticated/data-import")({
  component: DataImportRoute,
});

function DataImportRoute() {
  return (
    <>
      <PageHeader
        eyebrow="Market data"
        title="Data Import"
        icon={DatabaseZap}
      />

      <div className="mb-6 rounded-3xl border border-primary/20 bg-primary/8 p-5 text-sm text-muted-foreground">
        <p>
          Start by importing historical OHLC candle data. EdgeLab will validate the file, detect obvious candle issues and prepare the dataset for strategy testing.
        </p>
      </div>

      <DataImportPanel />
    </>
  );
}
