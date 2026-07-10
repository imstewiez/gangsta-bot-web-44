import type { MarketCandle } from "./market-data";

export function simpleMovingAverage(values: number[], period: number): Array<number | null> {
  return values.map((_, index) => {
    if (index + 1 < period) return null;
    const window = values.slice(index + 1 - period, index + 1);
    const sum = window.reduce((total, value) => total + value, 0);
    return sum / period;
  });
}

export function closePrices(candles: MarketCandle[]): number[] {
  return candles.map((candle) => candle.closePrice);
}

export function crossedAbove(previousFast: number | null, previousSlow: number | null, fast: number | null, slow: number | null): boolean {
  if (previousFast === null || previousSlow === null || fast === null || slow === null) return false;
  return previousFast <= previousSlow && fast > slow;
}

export function crossedBelow(previousFast: number | null, previousSlow: number | null, fast: number | null, slow: number | null): boolean {
  if (previousFast === null || previousSlow === null || fast === null || slow === null) return false;
  return previousFast >= previousSlow && fast < slow;
}
