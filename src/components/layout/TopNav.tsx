import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/membros", label: "Membros" },
  { to: "/inventario", label: "Inventário" },
  { to: "/receitas", label: "Receitas" },
  { to: "/encomendas", label: "Encomendas" },
  { to: "/operacoes", label: "Operações" },
  { to: "/cemiterio", label: "Cemitério" },
  { to: "/disponibilidade", label: "Disp." },
  { to: "/tops", label: "Tops" },
  { to: "/premios", label: "Prémios" },
] as const;

const ADMIN_NAV = [
  { to: "/admin", label: "Chefia" },
  { to: "/onboarding", label: "Onboarding" },
  { to: "/liquidacao", label: "Liquidação" },
  { to: "/sync", label: "Sync" },
  { to: "/auditoria", label: "Auditoria" },
] as const;

export function TopNav() {
  const { profile, isAdmin, signOut } = useAuth();
  const loc = useLocation();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
        <Link to="/dashboard" className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-sm bg-primary font-display text-primary-foreground">
            R
          </div>
          <span className="text-display text-sm font-bold tracking-widest">
            Firma RedWood
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => {
            const active = loc.pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={
                  "text-display text-xs px-3 py-1.5 rounded-sm transition-colors " +
                  (active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50")
                }
              >
                {n.label}
              </Link>
            );
          })}
          {isAdmin && ADMIN_NAV.map((n) => {
            const active = loc.pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={
                  "text-display text-xs px-3 py-1.5 rounded-sm transition-colors " +
                  (active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50")
                }
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:block">
            {profile?.display_name ?? "—"}
          </span>
          <Button size="sm" variant="ghost" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
