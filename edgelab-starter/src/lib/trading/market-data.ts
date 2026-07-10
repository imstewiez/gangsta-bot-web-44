export type MarketCandle = {
  timestamp: string;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  closePrice: number;
  volume?: number | null;
};

export function toTimestamp(value: string): string | null {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return null;
  return new Date(time).toISOString();
}

export function sortMarketCandles(rows: MarketCandle[]): MarketCandle[] {
  return [...rows].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export function validateMarketCandle(row: MarketCandle): string[] {
  const issues: string[] = [];

  if (!toTimestamp(row.timestamp)) issues.push("Invalid timestamp");
  if (!Number.isFinite(row.openPrice)) issues.push("Invalid open price");
  if (!Number.isFinite(row.highPrice)) issues.push("Invalid high price");
  if (!Number.isFinite(row.lowPrice)) issues.push("Invalid low price");
  if (!Number.isFinite(row.closePrice)) issues.push("Invalid close price");

  if (row.highPrice < Math.max(row.openPrice, row.closePrice, row.lowPrice)) {
    issues.push("High price is inconsistent with the candle range");
  }

  if (row.lowPrice > Math.min(row.openPrice, row.closePrice, row.highPrice)) {
    issues.push("Low price is inconsistent with the candle range");
  }

  return issues;
}
