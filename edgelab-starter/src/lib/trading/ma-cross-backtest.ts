import { closePrices, crossedAbove, crossedBelow, simpleMovingAverage } from "./indicators";
import { sortMarketCandles, type MarketCandle } from "./market-data";
import type { BacktestOutput, BacktestOrder, BacktestSettings, BalancePoint, PositionSide } from "./backtest-types";

export type MaCrossConfig = {
  fastPeriod: number;
  slowPeriod: number;
  direction: "buy_only" | "sell_only" | "both";
};

export function runMaCrossBacktest(candlesInput: MarketCandle[], config: MaCrossConfig, settings: BacktestSettings): BacktestOutput {
  const warnings: string[] = [];
  const candles = sortMarketCandles(candlesInput);

  if (candles.length < Math.max(config.fastPeriod, config.slowPeriod) + 2) {
    return emptyResult(settings.startingBalance, ["Not enough candles for selected moving average periods"]);
  }

  if (config.fastPeriod >= config.slowPeriod) {
    warnings.push("Fast period should normally be lower than slow period");
  }

  let balance = settings.startingBalance;
  let peakBalance = settings.startingBalance;
  const orders: BacktestOrder[] = [];
  const balanceCurve: BalancePoint[] = [];

  const closes = closePrices(candles);
  const fast = simpleMovingAverage(closes, config.fastPeriod);
  const slow = simpleMovingAverage(closes, config.slowPeriod);

  let openPosition: { side: PositionSide; entryTime: string; entryPrice: number; size: number } | null = null;

  for (let index = 1; index < candles.length; index += 1) {
    const candle = candles[index];
    const previousFast = fast[index - 1];
    const previousSlow = slow[index - 1];
    const currentFast = fast[index];
    const currentSlow = slow[index];

    const buySignal = crossedAbove(previousFast, previousSlow, currentFast, currentSlow);
    const sellSignal = crossedBelow(previousFast, previousSlow, currentFast, currentSlow);

    if (openPosition) {
      const oppositeSignal = (openPosition.side === "buy" && sellSignal) || (openPosition.side === "sell" && buySignal);
      const finalCandle = index === candles.length - 1;

      if (oppositeSignal || finalCandle) {
        const order = closePosition(openPosition, candle, settings.costPerOrder, oppositeSignal ? "opposite_signal" : "end_of_data");
        orders.push(order);
        balance += order.result;
        openPosition = null;
      }
    }

    if (!openPosition) {
      if (buySignal && config.direction !== "sell_only") {
        openPosition = openNewPosition("buy", candle, balance, settings.stakePercent);
      } else if (sellSignal && config.direction !== "buy_only") {
        openPosition = openNewPosition("sell", candle, balance, settings.stakePercent);
      }
    }

    peakBalance = Math.max(peakBalance, balance);
    const drawdown = peakBalance - balance;
    const drawdownPercent = peakBalance > 0 ? (drawdown / peakBalance) * 100 : 0;
    balanceCurve.push({ timestamp: candle.timestamp, balance, drawdown, drawdownPercent });
  }

  return {
    stats: buildStats(settings.startingBalance, balance, orders, balanceCurve),
    orders,
    balanceCurve,
    warnings,
  };
}

function openNewPosition(side: PositionSide, candle: MarketCandle, balance: number, stakePercent: number) {
  const stake = balance * (stakePercent / 100);
  const size = stake / candle.closePrice;
  return { side, entryTime: candle.timestamp, entryPrice: candle.closePrice, size };
}

function closePosition(position: { side: PositionSide; entryTime: string; entryPrice: number; size: number }, candle: MarketCandle, cost: number, reason: string): BacktestOrder {
  const raw = position.side === "buy"
    ? (candle.closePrice - position.entryPrice) * position.size
    : (position.entryPrice - candle.closePrice) * position.size;

  const result = raw - cost;

  return {
    side: position.side,
    entryTime: position.entryTime,
    exitTime: candle.timestamp,
    entryPrice: position.entryPrice,
    exitPrice: candle.closePrice,
    size: position.size,
    result,
    reason,
  };
}

function buildStats(startBalance: number, endBalance: number, orders: BacktestOrder[], curve: BalancePoint[]) {
  const positiveOrders = orders.filter((order) => order.result > 0).length;
  const negativeOrders = orders.filter((order) => order.result < 0).length;
  const totalOrders = orders.length;
  const successRate = totalOrders > 0 ? (positiveOrders / totalOrders) * 100 : 0;
  const largestDrawdown = Math.max(0, ...curve.map((point) => point.drawdown));
  const largestDrawdownPercent = Math.max(0, ...curve.map((point) => point.drawdownPercent));

  return {
    startBalance,
    endBalance,
    netResult: endBalance - startBalance,
    totalOrders,
    positiveOrders,
    negativeOrders,
    successRate,
    largestDrawdown,
    largestDrawdownPercent,
  };
}

function emptyResult(balance: number, warnings: string[]): BacktestOutput {
  return {
    stats: {
      startBalance: balance,
      endBalance: balance,
      netResult: 0,
      totalOrders: 0,
      positiveOrders: 0,
      negativeOrders: 0,
      successRate: 0,
      largestDrawdown: 0,
      largestDrawdownPercent: 0,
    },
    orders: [],
    balanceCurve: [],
    warnings,
  };
}
