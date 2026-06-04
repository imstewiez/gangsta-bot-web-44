# EdgeLab route wiring notes

This starter is intentionally isolated under `edgelab-starter/`. To turn it into a running app, copy these files into the root `src/` of a clean EdgeLab project that uses the Ballas app skeleton.

## Routes included

```txt
src/routes/_authenticated.tsx
src/routes/_authenticated/dashboard.tsx
src/routes/_authenticated/data-import.tsx
src/routes/_authenticated/strategies.tsx
src/routes/_authenticated/backtests.tsx
src/routes/_authenticated/settings.tsx
```

## Components included

```txt
src/components/layout/EdgeLabShell.tsx
src/components/layout/EdgeLabSidebar.tsx
src/components/trading/DataImportPanel.tsx
src/components/trading/StrategyDraftForm.tsx
src/components/trading/BacktestLabPanel.tsx
```

## Trading library included

```txt
src/lib/trading/market-data.ts
src/lib/trading/simple-csv.ts
src/lib/trading/import-market-data.ts
src/lib/trading/indicators.ts
src/lib/trading/backtest-types.ts
src/lib/trading/ma-cross-backtest.ts
src/lib/trading/sample-data.ts
```

## Expected app navigation

```txt
/dashboard      -> research overview
/data-import    -> CSV import, column mapping and validation
/strategies     -> MA Cross strategy draft
/backtests      -> sample backtest runner and report preview
/reports        -> placeholder next
/settings       -> default assumptions and roadmap
```

## Next engineering step

The next milestone is database wiring:

1. Create server functions for datasets.
2. Insert `market_datasets` row after CSV validation.
3. Bulk insert `ohlc_candles` rows.
4. List saved datasets on `/data-import`.
5. Allow `/backtests` to select a saved dataset instead of generated sample candles.

## Important

Do not wire this into Ballas production routes directly. Use a clean EdgeLab app root or a separate app target.
