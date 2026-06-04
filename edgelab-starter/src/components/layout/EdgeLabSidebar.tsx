import { Link, useLocation } from "@tanstack/react-router";
import { Activity, BarChart3, BrainCircuit, DatabaseZap, FlaskConical, Gauge, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/data-import", label: "Data Import", icon: DatabaseZap },
  { to: "/strategies", label: "Strategies", icon: BrainCircuit },
  { to: "/backtests", label: "Backtests", icon: FlaskConical },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function EdgeLabSidebar() {
  const location = useLocation();

  return (
    <aside className="hidden h-dvh w-72 shrink-0 border-r border-border/30 bg-background/60 p-3 backdrop-blur-xl lg:block">
      <div className="flex h-full flex-col rounded-3xl border border-border/40 bg-card/40 p-3 shadow-2xl">
        <Link to="/dashboard" className="mb-5 flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/10 p-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Activity className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-display text-sm font-black tracking-[0.18em] text-primary">EdgeLab</p>
            <p className="truncate text-xs text-muted-foreground">Trading research cockpit</p>
          </div>
        </Link>

        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={active
                  ? "flex items-center gap-3 rounded-2xl border border-primary/35 bg-primary/15 px-3 py-2.5 text-primary"
                  : "flex items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 text-muted-foreground hover:border-primary/25 hover:bg-primary/10 hover:text-primary"
                }
              >
                <item.icon className="h-4 w-4" />
                <span className="text-display text-xs tracking-[0.12em]">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-2xl border border-warning/25 bg-warning/10 p-3 text-xs text-warning">
          Backtests are simulations and never guarantee future results.
        </div>
      </div>
    </aside>
  );
}
