import { Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, X } from "lucide-react";
import { useState } from "react";
import { NotificationBell } from "./NotificationBell";
import { getCurrentMember } from "@/lib/pricing.functions";
import { TIER_LABELS, TIER_EMOJI, tierColor } from "@/lib/domain";
import redwoodLogo from "@/assets/redwood-logo.png";

type NavItem = { to: string; label: string; need?: "inventory" };

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Casa" },
  { to: "/membros", label: "Bairro" },
  { to: "/precario", label: "Preçário" },
  { to: "/encomendas", label: "Encomendas" },
  { to: "/entregas", label: "Entregas" },
  { to: "/inventario", label: "Armazém", need: "inventory" },
  { to: "/receitas", label: "Receitas" },
  { to: "/operacoes", label: "Saídas" },
  { to: "/disponibilidade", label: "Disp." },
  { to: "/tops", label: "Tops" },
  { to: "/premios", label: "Prémios" },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/admin", label: "Chefia" },
  { to: "/auditoria", label: "Auditoria" },
];

export function TopNav() {
  const { profile, isAdmin, signOut } = useAuth();
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const meFn = useServerFn(getCurrentMember);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn(), staleTime: 60_000 });
  const canSeeInv = me.data?.can_see_inventory ?? false;

  const visible = NAV.filter((n) => !n.need || (n.need === "inventory" && canSeeInv));

  const linkClass = (to: string) => {
    const active = loc.pathname === to || loc.pathname.startsWith(to + "/");
    return (
      "text-display text-[11px] tracking-[0.12em] px-2.5 py-1.5 rounded-sm transition-colors " +
      (active
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:text-foreground hover:bg-accent/50")
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link to="/dashboard" className="flex items-center gap-2 shrink-0">
          <div className="grid h-8 w-8 place-items-center rounded-sm bg-primary font-display text-primary-foreground shadow-[0_0_15px_-5px_color-mix(in_oklab,var(--primary)_60%,transparent)]">
            R
          </div>
          <span className="hidden text-display text-sm tracking-[0.2em] sm:block">
            RedWood
          </span>
        </Link>
        <nav className="hidden flex-1 items-center gap-0.5 lg:flex">
          {visible.map((n) => (
            <Link key={n.to} to={n.to} className={linkClass(n.to)}>
              {n.label}
            </Link>
          ))}
          {isAdmin && (
            <>
              <span className="mx-1.5 h-4 w-px bg-border" />
              {ADMIN_NAV.map((n) => (
                <Link key={n.to} to={n.to} className={linkClass(n.to)}>
                  {n.label}
                </Link>
              ))}
            </>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <NotificationBell />
          <span className="hidden text-xs text-muted-foreground sm:block">
            {profile?.display_name ?? "—"}
          </span>
          <Button size="sm" variant="ghost" onClick={signOut} title="Sair">
            <LogOut className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            title="Menu"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      {mobileOpen && (
        <div className="border-t border-border bg-background/95 lg:hidden">
          <nav className="mx-auto grid max-w-7xl grid-cols-3 gap-1 p-3">
            {visible.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setMobileOpen(false)}
                className={linkClass(n.to) + " text-center"}
              >
                {n.label}
              </Link>
            ))}
            {isAdmin &&
              ADMIN_NAV.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setMobileOpen(false)}
                  className={linkClass(n.to) + " text-center"}
                >
                  {n.label}
                </Link>
              ))}
          </nav>
        </div>
      )}
    </header>
  );
}
