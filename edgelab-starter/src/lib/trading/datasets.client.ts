import { supabase } from "../../integrations/supabase/client";
import type { MarketCandle } from "./market-data";

export type SavedDataset = {
  id: string;
  name: string;
  symbol: string;
  timeframe: string;
  row_count: number;
  first_candle_at: string | null;
  last_candle_at: string | null;
  created_at: string;
};

export type SaveDatasetInput = {
  name: string;
  symbol: string;
  timeframe: string;
  candles: MarketCandle[];
};

export async function listDatasets(): Promise<SavedDataset[]> {
  const { data, error } = await supabase
    .from("market_datasets")
    .select("id,name,symbol,timeframe,row_count,first_candle_at,last_candle_at,created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function saveDataset(input: SaveDatasetInput): Promise<SavedDataset> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const user = userData.user;
  if (!user) throw new Error("You must be logged in to save datasets.");
  if (input.candles.length === 0) throw new Error("Cannot save an empty dataset.");

  const sorted = [...input.candles].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const { data: dataset, error: datasetError } = await supabase
    .from("market_datasets")
    .insert({
      user_id: user.id,
      name: input.name,
      symbol: input.symbol,
      timeframe: input.timeframe,
      source: "csv",
      row_count: sorted.length,
      first_candle_at: first.timestamp,
      last_candle_at: last.timestamp,
    })
    .select("id,name,symbol,timeframe,row_count,first_candle_at,last_candle_at,created_at")
    .single();

  if (datasetError) throw datasetError;

  const candleRows = sorted.map((candle) => ({
    dataset_id: dataset.id,
    symbol: input.symbol,
    timeframe: input.timeframe,
    ts: candle.timestamp,
    open: candle.openPrice,
    high: candle.highPrice,
    low: candle.lowPrice,
    close: candle.closePrice,
    volume: candle.volume ?? null,
  }));

  const { error: candlesError } = await supabase.from("ohlc_candles").insert(candleRows);
  if (candlesError) throw candlesError;

  return dataset;
}

export async function loadDatasetCandles(datasetId: string): Promise<MarketCandle[]> {
  const { data, error } = await supabase
    .from("ohlc_candles")
    .select("ts,open,high,low,close,volume")
    .eq("dataset_id", datasetId)
    .order("ts", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    timestamp: row.ts,
    openPrice: Number(row.open),
    highPrice: Number(row.high),
    lowPrice: Number(row.low),
    closePrice: Number(row.close),
    volume: row.volume === null ? null : Number(row.volume),
  }));
}
