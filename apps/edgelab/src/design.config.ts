import {
  Activity,
  BarChart3,
  BrainCircuit,
  DatabaseZap,
  FlaskConical,
  Gauge,
  Settings,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Upload,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type ViewId = "dashboard" | "import" | "strategy" | "backtest" | "reports" | "settings";

export type NavItem = {
  id: ViewId;
  label: string;
  description: string;
  icon: LucideIcon;
  enabled: boolean;
};

export const productConfig = {
  name: "EdgeLab",
  shortName: "EL",
  version: "v0.1",
  eyebrow: "Trading research cockpit",
  description: "Import market data, design strategy rules and run deterministic backtests.",
  disclaimer: "Backtests are simulations and do not guarantee future results.",
};

export const designRules = {
  radius: {
    panel: "28px",
    card: "22px",
    control: "16px",
  },
  layout: {
    sidebarWidth: 296,
    maxContentWidth: 1260,
  },
  copyRules: [
    "No fake profitability claims.",
    "Every metric must state whether it is simulated or saved.",
    "Primary actions are limited to one per card.",
    "Warnings are amber, destructive errors are red, validated states are green.",
  ],
};

export const navigation: NavItem[] = [
  { id: "dashboard", label: "Dashboard", description: "Research overview", icon: Gauge, enabled: true },
  { id: "import", label: "Data Import", description: "Upload OHLC candles", icon: DatabaseZap, enabled: true },
  { id: "strategy", label: "Strategies", description: "Rule builder", icon: BrainCircuit, enabled: true },
  { id: "backtest", label: "Backtests", description: "Simulation lab", icon: FlaskConical, enabled: true },
  { id: "reports", label: "Reports", description: "Saved reports soon", icon: BarChart3, enabled: false },
  { id: "settings", label: "Settings", description: "Workspace defaults", icon: Settings, enabled: true },
];

export const pageCopy: Record<ViewId, { eyebrow: string; title: string; description: string; icon: LucideIcon }> = {
  dashboard: {
    eyebrow: "Research cockpit",
    title: "Strategy Intelligence Dashboard",
    description: "A premium workspace for importing data, shaping strategy rules and reading simulated performance clearly.",
    icon: Sparkles,
  },
  import: {
    eyebrow: "Market data",
    title: "Data Import Studio",
    description: "Load OHLC candle data, validate structure and prepare datasets for strategy testing.",
    icon: Upload,
  },
  strategy: {
    eyebrow: "Strategy lab",
    title: "Strategy Builder",
    description: "Start with a deterministic MA Cross model, then evolve into a full no-code strategy laboratory.",
    icon: BrainCircuit,
  },
  backtest: {
    eyebrow: "Backtest lab",
    title: "Simulation Engine",
    description: "Run strategy rules against the active dataset and inspect the simulated trade trail.",
    icon: Activity,
  },
  reports: {
    eyebrow: "Reports",
    title: "Performance Reports",
    description: "Saved reports, equity curves and exports will live here after database-backed runs are enabled.",
    icon: BarChart3,
  },
  settings: {
    eyebrow: "Workspace",
    title: "Settings",
    description: "Central rules, visual standards and default assumptions for the trading research app.",
    icon: Settings,
  },
};

export const dashboardCards = [
  { title: "Import Data", text: "Load OHLC CSV, validate candles and prepare a clean dataset.", target: "import" as ViewId, icon: DatabaseZap },
  { title: "Build Strategy", text: "Tune deterministic MA Cross parameters before running tests.", target: "strategy" as ViewId, icon: BrainCircuit },
  { title: "Run Backtest", text: "Execute strategy logic and inspect simulated orders.", target: "backtest" as ViewId, icon: TrendingUp },
];

export const statusCards = [
  { label: "Preview Mode", value: "Local", tone: "info" },
  { label: "Engine", value: "MA Cross", tone: "primary" },
  { label: "Risk Notice", value: "Required", tone: "warning" },
];

export const noticeConfig = {
  risk: { icon: ShieldAlert, text: productConfig.disclaimer },
};
