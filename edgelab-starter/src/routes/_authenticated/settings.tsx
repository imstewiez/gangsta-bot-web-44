import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";

import { EdgeLabPageHeader } from "../../components/layout/EdgeLabShell";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsRoute,
});

function SettingsRoute() {
  return (
    <>
      <EdgeLabPageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Configure default research assumptions for future backtests."
        icon={Settings}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card-frame rounded-3xl p-5">
          <h2 className="text-display text-lg font-bold">Default backtest assumptions</h2>
          <div className="mt-5 grid gap-4">
            <ReadOnlySetting label="Default balance" value="10,000" />
            <ReadOnlySetting label="Default stake" value="10% of balance" />
            <ReadOnlySetting label="Default cost" value="2 per order" />
          </div>
        </section>

        <section className="card-frame rounded-3xl p-5">
          <h2 className="text-display text-lg font-bold">Roadmap</h2>
          <div className="mt-5 space-y-3 text-sm text-muted-foreground">
            <p>1. Save user datasets to Supabase.</p>
            <p>2. Save strategy drafts to Supabase.</p>
            <p>3. Save backtest runs and reports.</p>
            <p>4. Add journal, risk tools and report exports.</p>
          </div>
        </section>
      </div>
    </>
  );
}

function ReadOnlySetting({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/40 bg-background/30 p-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
