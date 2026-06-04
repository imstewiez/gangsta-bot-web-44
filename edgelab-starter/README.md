# EdgeLab v0.1 Starter

This folder is a transferable starter pack for a new trading backtesting product. It is intentionally isolated from the Ballas production app.

## Product goal

EdgeLab is a premium trading research cockpit. The long-term app will support multiple trading workflows, but v0.1 focuses on the first complete usable loop:

```txt
Upload CSV -> Validate Data -> Build Strategy -> Run Backtest -> View Report
```

## Important boundary

Use the existing Ballas webapp only as a UI/UX and architecture skeleton:

- AppShell layout pattern
- sidebar/topbar/mobile drawer pattern
- PageHeader pattern
- PageTransition
- shared UI components
- Tailwind/design-system styling
- Supabase auth pattern
- TanStack Query setup
- Toaster/notifications

Do **not** reuse Ballas domain logic:

- members/membros
- Discord roles
- encomendas/orders
- entregas/deliveries
- inventory/inventario
- recipes/receitas
- prizes/premios
- materials/items/pricing logic
- view-as-member logic
- gang-specific permissions or terminology

## Starter contents

```txt
edgelab-starter/
  README.md
  supabase/migrations/001_edgelab_v01_schema.sql
  src/lib/trading/types.ts
  src/lib/trading/csv-import.ts
  src/lib/trading/indicators.ts
  src/lib/trading/backtest-engine.ts
```

## Suggested app routes

```txt
/dashboard
/data-import
/strategies
/strategies/$id
/backtests
/backtests/$id
/reports
/settings
```

## v0.1 implementation order

1. Create a new clean repo/app for EdgeLab.
2. Copy the Ballas app shell, UI components, styles, auth wrapper and TanStack Query setup.
3. Remove all Ballas routes/libs/assets/copy.
4. Apply the SQL migration from this starter.
5. Wire the CSV import validator into `/data-import`.
6. Save validated candles into `market_datasets` and `ohlc_candles`.
7. Build `/strategies` around the supported templates.
8. Wire `runBacktest` into `/backtests`.
9. Render `/backtests/$id` using the returned metrics, trades and equity curve.

## v0.1 strategy templates

The first deterministic templates should be:

- Moving Average Cross
- RSI Reversal
- Breakout

The initial engine in this starter currently implements a moving-average cross strategy and the shared metric/equity model. RSI and Breakout can be added as separate signal generators using the same `runBacktest` primitives.

## Trading disclaimer

Backtest results are simulations based on historical data and do not guarantee future results. The UI should show this clearly on every report page.
