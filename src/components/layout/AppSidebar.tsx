import { Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import {
  Home, Users, Trophy, Sparkles,
  ShoppingBag, PackageOpen, Crosshair,
  Tags, Package, Hammer,
  Shield, ScrollText,
  LogOut,
  type LucideIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { getCurrentMember } from "@/lib/pricing.functions";
import { TIER_LABELS, TIER_ACCENT } from "@/lib/domain";
import { TierIcon } from "@/components/domain/TierIcon";
import redwoodLogo from "@/assets/ballas-logo.png";
import { Button } from "@/components/ui/button";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  need?: "inventory";
  admin?: boolean;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const GROUPS: NavGroup[] = [
  {
    label: "Bairro",
    items: [
      { to: "/dashboard", label: "Casa",        icon: Home },
      { to: "/membros",   label: "Membros",     icon: Users },
      { to: "/tops",      label: "Leaderboard", icon: Trophy },
      { to: "/premios",   label: "Prémios",     icon: Sparkles },
    ],
  },
  {
    label: "Operação",
    items: [
      { to: "/encomendas",      label: "Encomendas",     icon: ShoppingBag },
      { to: "/entregas",        label: "Entregas",       icon: PackageOpen },
      { to: "/operacoes",       label: "Saídas",         icon: Crosshair },

    ],
  },
  {
    label: "Material",
    items: [
      { to: "/precario",   label: "Preçário",  icon: Tags },
      { to: "/inventario", label: "Armazém",   icon: Package, need: "inventory" },
      { to: "/receitas",   label: "Receitas",  icon: Hammer },
    ],
  },
  {
    label: "Chefia",
    items: [
      { to: "/admin",     label: "Definições", icon: Shield,     admin: true },
      { to: "/auditoria", label: "Auditoria",  icon: ScrollText, admin: true },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { profile, signOut } = useAuth();
  const loc = useLocation();

  const meFn = useAuthedServerFn(getCurrentMember);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn(), staleTime: 60_000 });

  const canSeeInv = me.data?.can_see_inventory ?? false;
  const myTier = me.data?.tier ?? null;
  const myTierLabel = myTier ? TIER_LABELS[myTier] ?? myTier : null;
  const myAccent = myTier ? TIER_ACCENT[myTier] : null;
  const myDisplay = me.data?.display_name ?? profile?.display_name ?? "—";

  const isActive = (to: string) =>
    loc.pathname === to || loc.pathname.startsWith(to + "/");

  return (
    <Sidebar collapsible="icon" className="border-r border-border/60">
      <SidebarHeader>
        <Link to="/dashboard" className="flex items-center gap-2.5 px-2 py-2 group">
          <img
            src={redwoodLogo}
            alt="Ballas Gang"
            className="h-9 w-9 shrink-0 rounded-sm object-contain drop-shadow-[0_0_14px_color-mix(in_oklab,var(--primary)_60%,transparent)] transition-transform group-hover:scale-105"
          />
          {!collapsed && (
            <div className="leading-tight">
              <div className="text-display text-sm tracking-[0.24em]">
                <span className="bg-gradient-to-b from-primary to-blood bg-clip-text text-transparent">Ballas</span> Gang
              </div>
              <div className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground/80">
                Casa fechada
              </div>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {GROUPS.map((g) => {
          const items = g.items.filter((it) => {
            if (it.admin && !(me.data?.is_manager ?? false)) return false;
            if (it.need === "inventory" && !canSeeInv) return false;
            return true;
          });
          if (!items.length) return null;
          return (
            <SidebarGroup key={g.label}>
              {!collapsed && (
                <SidebarGroupLabel className="text-[10px] tracking-[0.32em]">
                  {g.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((it) => {
                    const active = isActive(it.to);
                    return (
                      <SidebarMenuItem key={it.to}>
                        <SidebarMenuButton asChild isActive={active} tooltip={it.label}>
                          <Link to={it.to} className="flex items-center gap-2.5">
                            <it.icon className="h-4 w-4 shrink-0" />
                            <span className="text-display text-[12px] tracking-[0.12em]">
                              {it.label}
                            </span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter>
        {!collapsed ? (
          <div className="flex items-center gap-2 px-1.5 py-1">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border bg-background/40"
              style={{
                borderColor: myAccent
                  ? `color-mix(in oklab, ${myAccent} 55%, transparent)`
                  : undefined,
              }}
              title={myTierLabel ? `${myTierLabel} · ${myDisplay}` : myDisplay}
            >
              <TierIcon tier={myTier} size="sm" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-semibold">{myDisplay}</div>
              {myTierLabel && (
                <div
                  className="truncate text-[10px] uppercase tracking-[0.16em]"
                  style={{ color: myAccent ?? undefined }}
                >
                  {myTierLabel}
                </div>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={signOut}
              title="Sair do bairro"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={signOut}
            title="Sair do bairro"
            className="mx-auto h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
