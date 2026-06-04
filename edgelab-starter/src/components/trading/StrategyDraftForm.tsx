import { useState } from "react";

export type StrategyDraft = {
  name: string;
  fastPeriod: number;
  slowPeriod: number;
  direction: "long" | "short" | "both";
};

const initialDraft: StrategyDraft = {
  name: "MA Cross Baseline",
  fastPeriod: 20,
  slowPeriod: 50,
  direction: "both",
};

export function StrategyDraftForm() {
  const [draft, setDraft] = useState<StrategyDraft>(initialDraft);
  const [saved, setSaved] = useState(false);

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <section className="card-frame rounded-3xl p-5">
        <h2 className="text-display text-lg font-bold">Strategy Builder</h2>
        <p className="mt-1 text-sm text-muted-foreground">Create the first moving-average strategy draft.</p>

        <div className="mt-5 grid gap-4">
          <label className="space-y-1.5">
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Name</span>
            <input className="w-full rounded-2xl border border-border/50 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Fast MA</span>
              <input className="w-full rounded-2xl border border-border/50 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary" type="number" value={draft.fastPeriod} onChange={(event) => setDraft({ ...draft, fastPeriod: Number(event.target.value) })} />
            </label>

            <label className="space-y-1.5">
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Slow MA</span>
              <input className="w-full rounded-2xl border border-border/50 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary" type="number" value={draft.slowPeriod} onChange={(event) => setDraft({ ...draft, slowPeriod: Number(event.target.value) })} />
            </label>
          </div>

          <label className="space-y-1.5">
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Direction</span>
            <select className="w-full rounded-2xl border border-border/50 bg-background/60 px-3 py-2 text-sm outline-none focus:border-primary" value={draft.direction} onChange={(event) => setDraft({ ...draft, direction: event.target.value as StrategyDraft["direction"] })}>
              <option value="both">Long and short</option>
              <option value="long">Long only</option>
              <option value="short">Short only</option>
            </select>
          </label>

          <button className="rounded-2xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" onClick={() => setSaved(true)}>
            Save draft
          </button>
        </div>
      </section>

      <section className="card-frame rounded-3xl p-5">
        <h2 className="text-display text-lg font-bold">Preview</h2>
        <div className="mt-5 space-y-3 rounded-2xl border border-border/40 bg-background/30 p-4 text-sm">
          <Row label="Template" value="Moving Average Cross" />
          <Row label="Name" value={draft.name || "Untitled"} />
          <Row label="Fast MA" value={`${draft.fastPeriod}`} />
          <Row label="Slow MA" value={`${draft.slowPeriod}`} />
          <Row label="Direction" value={draft.direction} />
        </div>

        {draft.fastPeriod >= draft.slowPeriod && (
          <div className="mt-5 rounded-2xl border border-warning/30 bg-warning/10 p-4 text-sm text-warning">
            Fast MA should normally be lower than Slow MA.
          </div>
        )}

        {saved && (
          <div className="mt-5 rounded-2xl border border-success/30 bg-success/10 p-4 text-sm text-success">
            Draft saved locally. Database save comes next.
          </div>
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/20 pb-2 last:border-b-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
