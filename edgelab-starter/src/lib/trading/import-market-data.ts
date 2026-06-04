import { rowsToObjects, readCsvRows } from "./simple-csv";
import { toTimestamp, validateMarketCandle, type MarketCandle } from "./market-data";

export type MarketColumnMap = {
  time: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume?: string;
};

export type ImportIssue = {
  row: number;
  message: string;
};

export function importMarketData(raw: string, map: MarketColumnMap): { candles: MarketCandle[]; issues: ImportIssue[] } {
  const objects = rowsToObjects(readCsvRows(raw));
  const candles: MarketCandle[] = [];
  const issues: ImportIssue[] = [];

  objects.forEach((row, index) => {
    const timestamp = toTimestamp(row[map.time] ?? "");
    if (!timestamp) {
      issues.push({ row: index + 2, message: "Invalid timestamp" });
      return;
    }

    const candle: MarketCandle = {
      timestamp,
      openPrice: Number(row[map.open]),
      highPrice: Number(row[map.high]),
      lowPrice: Number(row[map.low]),
      closePrice: Number(row[map.close]),
      volume: map.volume ? Number(row[map.volume]) : null,
    };

    const errors = validateMarketCandle(candle);
    if (errors.length > 0) {
      errors.forEach((message) => issues.push({ row: index + 2, message }));
      return;
    }

    candles.push(candle);
  });

  return { candles, issues };
}
