import type { MarketCandle } from "./market-data";

export function createSampleCandles(): MarketCandle[] {
  const rows: MarketCandle[] = [];
  const start = new Date("2025-01-01T00:00:00.000Z").getTime();
  let price = 2000;

  for (let index = 0; index < 160; index += 1) {
    const wave = Math.sin(index / 8) * 8;
    const drift = index * 0.22;
    const close = price + wave + drift;
    const open = price;
    const high = Math.max(open, close) + 3;
    const low = Math.min(open, close) - 3;

    rows.push({
      timestamp: new Date(start + index * 60 * 60 * 1000).toISOString(),
      openPrice: round(open),
      highPrice: round(high),
      lowPrice: round(low),
      closePrice: round(close),
      volume: 1000 + index,
    });

    price = close;
  }

  return rows;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
