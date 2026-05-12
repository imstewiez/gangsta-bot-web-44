import { Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  LogOut, Menu, X,
  Home, Users, Tags, ShoppingBag, PackageOpen, Package, Hammer,
  Crosshair, CalendarClock, Trophy, Sparkles, Shield, ScrollText,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { NotificationBell } from "./NotificationBell";
import { getCurrentMember } from "@/lib/pricing.functions";
import { TIER_LABELS, TIER_ACCENT } from "@/lib/domain";
import { TierIcon } from "@/components/domain/TierIcon";
import redwoodLogo from "@/assets/redwood-logo.png";

type NavItem = { to: string; label: string; icon: LucideIcon; need?: "inventory" };

const NAV: NavItem[] = [
  { to: "/dashboard",       label: "Casa",        icon: Home },
  { to: "/membros",         label: "Membros",     icon: Users },
  { to: "/precario",        label: "Preçário",    icon: Tags },
  { to: "/encomendas",      label: "Encomendas",  icon: ShoppingBag },
  { to: "/entregas",        label: "Entregas",    icon: PackageOpen },
  { to: "/inventario",      label: "Armazém",     icon: Package, need: "inventory" },
  { to: "/receitas",        label: "Receitas",    icon: Hammer },
  { to: "/operacoes",       label: "Saídas",      icon: Crosshair },
  { to: "/disponibilidade", label: "Disp.",       icon: CalendarClock },
  { to: "/tops",            label: "Leaderboard", icon: Trophy },
  { to: "/premios",         label: "Prémios",     icon: Sparkles },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/admin",     label: "Chefia",    icon: Shield },
  { to: "/auditoria", label: "Auditoria", icon: ScrollText },
];

export function TopNav() {
  const { profile, isAdmin, signOut } = useAuth();
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const meFn = useServerFn(getCurrentMember);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn(), staleTime: 60_000 });
  const canSeeInv = me.data?.can_see_inventory ?? false;
  const myTier = me.data?.tier ?? null;
  const myTierLabel = myTier ? TIER_LABELS[myTier] ?? myTier : null;
  const myAccent = myTier ? TIER_ACCENT[myTier] : null;
  const myDisplay = me.data?.display_name ?? profile?.display_name ?? "—";

  const visible = NAV.filter((n) => !n.need || (n.need === "inventory" && canSeeInv));

  const linkClass = (to: string) => {
    const active = loc.pathname === to || loc.pathname.startsWith(to + "/");
    return (
      "relative inline-flex items-center gap-1.5 text-display text-[11px] tracking-[0.16em] px-2.5 py-1.5 rounded-sm transition-all " +
      (active
        ? "text-primary-foreground bg-primary shadow-[0_0_18px_-6px_var(--primary)]"
        : "text-muted-foreground hover:text-foreground hover:bg-accent/40")
    );
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl supports-[backdrop-filter]:bg-background/55">
      <div aria-hidden className="absolute inset-x-0 -bottom-px hairline-top" />
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Link to="/dashboard" className="flex items-center gap-2.5 shrink-0 group">
          <img
            src={redwoodLogo}
            alt="RedWood"
            className="h-10 w-10 rounded-sm object-contain drop-shadow-[0_0_14px_color-mix(in_oklab,var(--primary)_60%,transparent)] transition-transform group-hover:scale-105"
          />
          <span className="hidden text-display text-sm tracking-[0.24em] sm:block">
            RedWood
          </span>
        </Link>
        <nav className="hidden flex-1 items-center gap-0.5 lg:flex">
          {visible.map((n) => (
            <Link key={n.to} to={n.to} className={linkClass(n.to)}>
              <n.icon className="h-3.5 w-3.5" />
              <span>{n.label}</span>
            </Link>
          ))}
          {isAdmin && (
            <>
              <span className="mx-1.5 h-4 w-px bg-border" />
              {ADMIN_NAV.map((n) => (
                <Link key={n.to} to={n.to} className={linkClass(n.to)}>
                  <n.icon className="h-3.5 w-3.5" />
                  <span>{n.label}</span>
                </Link>
              ))}
            </>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <NotificationBell />
          <span
            className="hidden items-center gap-2 rounded-full border bg-card/40 px-2 py-1 text-display text-[11px] tracking-[0.08em] sm:inline-flex"
            style={{
              borderColor: myAccent ? `color-mix(in oklab, ${myAccent} 55%, transparent)` : undefined,
            }}
            title={myTierLabel ? `${myTierLabel} — ${myDisplay}` : myDisplay}
          >
            <TierIcon tier={myTier} size="sm" />
            {myTierLabel && (
              <span className="opacity-90" style={{ color: myAccent ?? undefined }}>
                {myTierLabel}
              </span>
            )}
            {myTierLabel && <span className="opacity-40">·</span>}
            <span className="font-semibold tracking-normal normal-case text-foreground">{myDisplay}</span>
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
                className={linkClass(n.to) + " justify-center"}
              >
                <n.icon className="h-3.5 w-3.5" />
                <span>{n.label}</span>
              </Link>
            ))}
            {isAdmin &&
              ADMIN_NAV.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setMobileOpen(false)}
                  className={linkClass(n.to) + " justify-center"}
                >
                  <n.icon className="h-3.5 w-3.5" />
                  <span>{n.label}</span>
                </Link>
              ))}
          </nav>
        </div>
      )}
    </header>
  );
}
