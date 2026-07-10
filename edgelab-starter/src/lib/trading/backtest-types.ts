export type PositionSide = "buy" | "sell";

export type BacktestSettings = {
  startingBalance: number;
  stakePercent: number;
  costPerOrder: number;
};

export type BacktestOrder = {
  side: PositionSide;
  entryTime: string;
  exitTime: string;
  entryPrice: number;
  exitPrice: number;
  size: number;
  result: number;
  reason: string;
};

export type BalancePoint = {
  timestamp: string;
  balance: number;
  drawdown: number;
  drawdownPercent: number;
};

export type BacktestStats = {
  startBalance: number;
  endBalance: number;
  netResult: number;
  totalOrders: number;
  positiveOrders: number;
  negativeOrders: number;
  successRate: number;
  largestDrawdown: number;
  largestDrawdownPercent: number;
};

export type BacktestOutput = {
  stats: BacktestStats;
  orders: BacktestOrder[];
  balanceCurve: BalancePoint[];
  warnings: string[];
};
