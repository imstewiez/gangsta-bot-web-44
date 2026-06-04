-- EdgeLab v0.1 schema
-- Fresh trading-specific schema. Do not apply to the Ballas production database unless intentionally creating a separate EdgeLab environment.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.market_datasets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  symbol text not null,
  timeframe text not null,
  source text not null default 'csv',
  row_count integer not null default 0,
  first_candle_at timestamptz,
  last_candle_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ohlc_candles (
  id bigserial primary key,
  dataset_id uuid not null references public.market_datasets(id) on delete cascade,
  symbol text not null,
  timeframe text not null,
  ts timestamptz not null,
  open numeric not null,
  high numeric not null,
  low numeric not null,
  close numeric not null,
  volume numeric,
  created_at timestamptz not null default now(),
  constraint ohlc_candles_unique_ts unique(dataset_id, ts),
  constraint ohlc_candles_prices_valid check (
    high >= open and high >= close and high >= low and low <= open and low <= close
  )
);

create index if not exists idx_ohlc_candles_dataset_ts on public.ohlc_candles(dataset_id, ts);
create index if not exists idx_market_datasets_user_created on public.market_datasets(user_id, created_at desc);

create table if not exists public.strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  strategy_type text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint strategies_type_valid check (strategy_type in ('ma_cross', 'rsi_reversal', 'breakout'))
);

create index if not exists idx_strategies_user_created on public.strategies(user_id, created_at desc);

create table if not exists public.strategy_versions (
  id uuid primary key default gen_random_uuid(),
  strategy_id uuid not null references public.strategies(id) on delete cascade,
  version integer not null,
  config jsonb not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint strategy_versions_unique unique(strategy_id, version)
);

create table if not exists public.backtest_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  strategy_id uuid not null references public.strategies(id) on delete cascade,
  dataset_id uuid not null references public.market_datasets(id) on delete cascade,
  status text not null default 'queued',
  starting_balance numeric not null,
  risk_per_trade numeric not null,
  spread numeric not null default 0,
  commission numeric not null default 0,
  slippage numeric not null default 0,
  date_from timestamptz,
  date_to timestamptz,
  metrics jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint backtest_status_valid check (status in ('queued', 'running', 'completed', 'failed')),
  constraint backtest_balance_positive check (starting_balance > 0),
  constraint backtest_risk_valid check (risk_per_trade > 0 and risk_per_trade <= 100)
);

create index if not exists idx_backtest_runs_user_created on public.backtest_runs(user_id, created_at desc);
create index if not exists idx_backtest_runs_strategy on public.backtest_runs(strategy_id);
create index if not exists idx_backtest_runs_dataset on public.backtest_runs(dataset_id);

create table if not exists public.backtest_trades (
  id uuid primary key default gen_random_uuid(),
  backtest_run_id uuid not null references public.backtest_runs(id) on delete cascade,
  side text not null,
  entry_time timestamptz not null,
  exit_time timestamptz,
  entry_price numeric not null,
  exit_price numeric,
  stop_loss numeric,
  take_profit numeric,
  quantity numeric,
  risk_amount numeric,
  pnl numeric,
  pnl_r numeric,
  fees numeric not null default 0,
  outcome text,
  exit_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint backtest_trade_side_valid check (side in ('long', 'short')),
  constraint backtest_trade_outcome_valid check (outcome is null or outcome in ('win', 'loss', 'breakeven'))
);

create index if not exists idx_backtest_trades_run_entry on public.backtest_trades(backtest_run_id, entry_time);

create table if not exists public.backtest_equity_points (
  id bigserial primary key,
  backtest_run_id uuid not null references public.backtest_runs(id) on delete cascade,
  ts timestamptz not null,
  balance numeric not null,
  equity numeric not null,
  drawdown numeric not null,
  drawdown_pct numeric not null,
  created_at timestamptz not null default now(),
  constraint backtest_equity_unique_ts unique(backtest_run_id, ts)
);

create index if not exists idx_backtest_equity_run_ts on public.backtest_equity_points(backtest_run_id, ts);

alter table public.profiles enable row level security;
alter table public.market_datasets enable row level security;
alter table public.ohlc_candles enable row level security;
alter table public.strategies enable row level security;
alter table public.strategy_versions enable row level security;
alter table public.backtest_runs enable row level security;
alter table public.backtest_trades enable row level security;
alter table public.backtest_equity_points enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "datasets_select_own" on public.market_datasets for select using (auth.uid() = user_id);
create policy "datasets_insert_own" on public.market_datasets for insert with check (auth.uid() = user_id);
create policy "datasets_update_own" on public.market_datasets for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "datasets_delete_own" on public.market_datasets for delete using (auth.uid() = user_id);

create policy "candles_select_own_dataset" on public.ohlc_candles for select using (
  exists (select 1 from public.market_datasets d where d.id = dataset_id and d.user_id = auth.uid())
);
create policy "candles_insert_own_dataset" on public.ohlc_candles for insert with check (
  exists (select 1 from public.market_datasets d where d.id = dataset_id and d.user_id = auth.uid())
);
create policy "candles_delete_own_dataset" on public.ohlc_candles for delete using (
  exists (select 1 from public.market_datasets d where d.id = dataset_id and d.user_id = auth.uid())
);

create policy "strategies_select_own" on public.strategies for select using (auth.uid() = user_id);
create policy "strategies_insert_own" on public.strategies for insert with check (auth.uid() = user_id);
create policy "strategies_update_own" on public.strategies for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "strategies_delete_own" on public.strategies for delete using (auth.uid() = user_id);

create policy "strategy_versions_select_own" on public.strategy_versions for select using (
  exists (select 1 from public.strategies s where s.id = strategy_id and s.user_id = auth.uid())
);
create policy "strategy_versions_insert_own" on public.strategy_versions for insert with check (
  exists (select 1 from public.strategies s where s.id = strategy_id and s.user_id = auth.uid())
);

create policy "backtest_runs_select_own" on public.backtest_runs for select using (auth.uid() = user_id);
create policy "backtest_runs_insert_own" on public.backtest_runs for insert with check (auth.uid() = user_id);
create policy "backtest_runs_update_own" on public.backtest_runs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "backtest_runs_delete_own" on public.backtest_runs for delete using (auth.uid() = user_id);

create policy "backtest_trades_select_own_run" on public.backtest_trades for select using (
  exists (select 1 from public.backtest_runs r where r.id = backtest_run_id and r.user_id = auth.uid())
);
create policy "backtest_trades_insert_own_run" on public.backtest_trades for insert with check (
  exists (select 1 from public.backtest_runs r where r.id = backtest_run_id and r.user_id = auth.uid())
);

create policy "equity_points_select_own_run" on public.backtest_equity_points for select using (
  exists (select 1 from public.backtest_runs r where r.id = backtest_run_id and r.user_id = auth.uid())
);
create policy "equity_points_insert_own_run" on public.backtest_equity_points for insert with check (
  exists (select 1 from public.backtest_runs r where r.id = backtest_run_id and r.user_id = auth.uid())
);
