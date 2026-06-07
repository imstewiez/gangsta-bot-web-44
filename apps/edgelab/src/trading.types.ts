export type Candle = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number | null;
};

export type StrategyDirection = "long" | "short" | "both";

export type Strategy = {
  name: string;
  fast: number;
  slow: number;
  direction: StrategyDirection;
};

export type BacktestSettings = {
  startingBalance: number;
  stakePercent: number;
  orderCost: number;
};

export type Order = {
  side: "long" | "short";
  entryTime: string;
  exitTime: string;
  entry: number;
  exit: number;
  result: number;
  reason: string;
};

export type EquityPoint = {
  timestamp: string;
  balance: number;
  drawdown: number;
  drawdownPercent: number;
};

export type Backtest = {
  startBalance: number;
  endBalance: number;
  net: number;
  netPercent: number;
  orders: Order[];
  winRate: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number | null;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  equity: EquityPoint[];
};

export type DatasetQuality = {
  candles: number;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  invalidCandles: number;
};
