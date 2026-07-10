import type { Backtest, BacktestSettings, Candle, DatasetQuality, EquityPoint, Order, Strategy } from "./trading.types";

export const defaultBacktestSettings: BacktestSettings = {
  startingBalance: 10000,
  stakePercent: 10,
  orderCost: 2,
};

export function sampleCandles(): Candle[] {
  const rows: Candle[] = [];
  let price = 2000;
  const start = Date.UTC(2025, 0, 1);

  for (let i = 0; i < 220; i += 1) {
    const volatility = Math.sin(i / 8) * 8 + Math.cos(i / 17) * 5;
    const drift = i * 0.16;
    const close = round(price + volatility + drift);
    const open = round(price);
    rows.push({
      timestamp: new Date(start + i * 3600000).toISOString(),
      open,
      high: round(Math.max(open, close) + 3.4),
      low: round(Math.min(open, close) - 3.1),
      close,
      volume: 1000 + i * 3,
    });
    price = close;
  }

  return rows;
}

export function parseCsv(raw: string): Candle[] {
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const headers = (lines[0] ?? "").split(",").map((header) => header.trim().toLowerCase());
  const idx = (names: string[]) => names.map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1;
  const timeIndex = idx(["time", "timestamp", "date", "open_time"]);
  const openIndex = idx(["open", "o"]);
  const highIndex = idx(["high", "h"]);
  const lowIndex = idx(["low", "l"]);
  const closeIndex = idx(["close", "c"]);
  const volumeIndex = idx(["volume", "vol", "v"]);

  if ([timeIndex, openIndex, highIndex, lowIndex, closeIndex].some((index) => index < 0)) return [];

  return lines.slice(1)
    .map((line) => line.split(","))
    .map((cols) => ({
      timestamp: new Date(cols[timeIndex]).toISOString(),
      open: Number(cols[openIndex]),
      high: Number(cols[highIndex]),
      low: Number(cols[lowIndex]),
      close: Number(cols[closeIndex]),
      volume: volumeIndex >= 0 ? Number(cols[volumeIndex]) : null,
    }))
    .filter(isValidCandle)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function getDatasetQuality(candles: Candle[]): DatasetQuality {
  const invalidCandles = candles.filter((candle) => !isValidCandle(candle)).length;
  const sorted = [...candles].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return {
    candles: candles.length,
    firstTimestamp: sorted[0]?.timestamp ?? null,
    lastTimestamp: sorted[sorted.length - 1]?.timestamp ?? null,
    invalidCandles,
  };
}

export function runBacktest(candlesInput: Candle[], strategy: Strategy, settings: BacktestSettings = defaultBacktestSettings): Backtest {
  const candles = candlesInput.filter(isValidCandle).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const closes = candles.map((candle) => candle.close);
  const fast = sma(closes, strategy.fast);
  const slow = sma(closes, strategy.slow);

  let balance = settings.startingBalance;
  let peak = settings.startingBalance;
  let maxDrawdown = 0;
  let maxDrawdownPercent = 0;
  const orders: Order[] = [];
  const equity: EquityPoint[] = [];
  let position: { side: "long" | "short"; entry: number; entryTime: string; size: number } | null = null;

  for (let i = 1; i < candles.length; i += 1) {
    const up = fast[i - 1] <= slow[i - 1] && fast[i] > slow[i];
    const down = fast[i - 1] >= slow[i - 1] && fast[i] < slow[i];
    const candle = candles[i];
    const price = candle.close;

    if (position && ((position.side === "long" && down) || (position.side === "short" && up) || i === candles.length - 1)) {
      const raw = position.side === "long" ? (price - position.entry) * position.size : (position.entry - price) * position.size;
      const result = raw - settings.orderCost;
      orders.push({ side: position.side, entryTime: position.entryTime, exitTime: candle.timestamp, entry: position.entry, exit: price, result, reason: i === candles.length - 1 ? "end" : "cross" });
      balance += result;
      position = null;
    }

    if (!position && up && strategy.direction !== "short") position = openPosition("long", candle, balance, settings);
    if (!position && down && strategy.direction !== "long") position = openPosition("short", candle, balance, settings);

    peak = Math.max(peak, balance);
    const drawdown = peak - balance;
    const drawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
    maxDrawdownPercent = Math.max(maxDrawdownPercent, drawdownPercent);
    equity.push({ timestamp: candle.timestamp, balance, drawdown, drawdownPercent });
  }

  const grossProfit = orders.filter((order) => order.result > 0).reduce((sum, order) => sum + order.result, 0);
  const grossLoss = Math.abs(orders.filter((order) => order.result < 0).reduce((sum, order) => sum + order.result, 0));
  const wins = orders.filter((order) => order.result > 0).length;
  const net = balance - settings.startingBalance;

  return {
    startBalance: settings.startingBalance,
    endBalance: balance,
    net,
    netPercent: (net / settings.startingBalance) * 100,
    orders,
    winRate: orders.length ? (wins / orders.length) * 100 : 0,
    grossProfit,
    grossLoss,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? null : 0,
    maxDrawdown,
    maxDrawdownPercent,
    equity,
  };
}

function openPosition(side: "long" | "short", candle: Candle, balance: number, settings: BacktestSettings) {
  const stake = balance * (settings.stakePercent / 100);
  const size = stake / candle.close;
  return { side, entry: candle.close, entryTime: candle.timestamp, size };
}

export function sma(values: number[], period: number): number[] {
  return values.map((_, index) => {
    if (index + 1 < period) return Number.NaN;
    const window = values.slice(index + 1 - period, index + 1);
    return window.reduce((sum, value) => sum + value, 0) / period;
  });
}

function isValidCandle(candle: Candle): boolean {
  return Boolean(
    candle.timestamp &&
    !Number.isNaN(new Date(candle.timestamp).getTime()) &&
    Number.isFinite(candle.open) &&
    Number.isFinite(candle.high) &&
    Number.isFinite(candle.low) &&
    Number.isFinite(candle.close) &&
    candle.high >= Math.max(candle.open, candle.close, candle.low) &&
    candle.low <= Math.min(candle.open, candle.close, candle.high)
  );
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
