import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Database,
  Hammer,
  Home,
  LogOut,
  Package,
  PackageOpen,
  ScrollText,
  Shield,
  ShoppingBag,
  Sparkles,
  Tags,
  Trophy,
  Users,
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
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { getCurrentMember } from "@/lib/pricing.functions";
import { TIER_ACCENT, TIER_LABELS } from "@/lib/domain";
import { TierIcon } from "@/components/domain/TierIcon";
import ballasLogo from "@/assets/ballas-logo.png";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: LucideIcon; need?: "inventory"; admin?: boolean };
type NavGroup = { label: string; items: NavItem[] };

const GROUPS: NavGroup[] = [
  { label: "Geral", items: [{ to: "/dashboard", label: "Início", icon: Home }, { to: "/membros", label: "Membros", icon: Users }, { to: "/tops", label: "Classificação", icon: Trophy }, { to: "/premios", label: "Prémios", icon: Sparkles }] },
  { label: "Operação", items: [{ to: "/encomendas", label: "Encomendas", icon: ShoppingBag }, { to: "/entregas", label: "Entregas", icon: PackageOpen }, { to: "/operacoes", label: "Saídas", icon: Crosshair }] },
  { label: "Inventário", items: [{ to: "/precario", label: "Preçário", icon: Tags }, { to: "/inventario", label: "Inventário", icon: Package, need: "inventory" }, { to: "/receitas", label: "Receitas", icon: Hammer }] },
  { label: "Gestão", items: [{ to: "/admin/dashboard", label: "Painel", icon: Activity, admin: true }, { to: "/admin/itens", label: "Itens", icon: Package, admin: true }, { to: "/admin/dados", label: "Dados", icon: Database, admin: true }, { to: "/admin", label: "Definições", icon: Shield, admin: true }, { to: "/auditoria", label: "Auditoria", icon: ScrollText, admin: true }] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { profile, signOut } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();

  const meFn = useAuthedServerFn(getCurrentMember);
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn(), staleTime: 60_000 });

  const canSeeInv = me.data?.can_see_inventory ?? false;
  const myTier = me.data?.tier ?? null;
  const myTierLabel = myTier ? TIER_LABELS[myTier] ?? myTier : null;
  const myAccent = myTier ? TIER_ACCENT[myTier] : null;
  const myDisplay = me.data?.display_name ?? profile?.display_name ?? "—";

  const isActive = (to: string) => {
    if (loc.pathname === to || loc.pathname === to + "/") return true;
    if (["/admin"].includes(to)) return false;
    return loc.pathname.startsWith(to + "/");
  };

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className={cn("relative z-10", collapsed ? "p-1" : "p-2")}>
        <div className={cn("sidebar-liquid-card flex rounded-2xl", collapsed ? "w-full flex-col items-center gap-1.5 p-1" : "items-center gap-2 p-2")}>
          <Link to="/dashboard" className={cn("group grid shrink-0 place-items-center rounded-xl", collapsed ? "h-8 w-8" : "h-9 w-9")} title="Ballas Gang">
            <img src={ballasLogo} alt="Ballas Gang" className={cn("logo-hd rounded-sm object-contain transition-transform group-hover:scale-105", collapsed ? "h-7 w-7" : "h-8 w-8")} />
          </Link>
          {!collapsed && <div className="min-w-0 flex-1 text-display text-sm tracking-[0.22em]"><span className="bg-gradient-to-b from-primary to-blood bg-clip-text text-transparent">Ballas</span> Gang</div>}
          <SidebarTrigger className={cn("shrink-0 rounded-xl border border-primary/20 bg-primary/8 text-primary hover:bg-primary/14", collapsed ? "h-8 w-8" : "h-8 w-8")} title={collapsed ? "Abrir menu" : "Fechar menu"}>
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </SidebarTrigger>
        </div>
      </SidebarHeader>

      <SidebarContent className={cn("relative z-10 pb-2", collapsed ? "px-1" : "px-2")}>
        {GROUPS.map((g) => {
          const items = g.items.filter((it) => {
            if (it.admin && !(me.data?.is_manager ?? false)) return false;
            if (it.need === "inventory" && !canSeeInv) return false;
            return true;
          });
          if (!items.length) return null;
          return (
            <SidebarGroup key={g.label} className="px-0 py-1.5">
              {!collapsed && <SidebarGroupLabel className="h-7 px-2 text-[10px] tracking-[0.3em] font-display text-sidebar-foreground/48">{g.label}</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu className="gap-1.5">
                  {items.map((it) => {
                    const active = isActive(it.to);
                    return (
                      <SidebarMenuItem key={it.to}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={it.label}
                          className="h-9 rounded-xl border border-transparent text-sidebar-foreground/74 hover:border-primary/30 hover:bg-primary/10 hover:text-primary data-[active=true]:border-primary/35 data-[active=true]:bg-primary/16 data-[active=true]:text-primary"
                        >
                          <Link to={it.to} className="flex items-center gap-2.5">
                            <it.icon className="h-4 w-4 shrink-0" />
                            <span className="text-display text-[12px] tracking-[0.1em]">{it.label}</span>
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

      <SidebarFooter className={cn("relative z-10", collapsed ? "p-1" : "p-2")}>
        {!collapsed ? (
          <div className="sidebar-liquid-card flex items-center gap-2 rounded-2xl p-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border bg-background/40" style={{ borderColor: myAccent ? `color-mix(in oklab, ${myAccent} 55%, transparent)` : undefined }} title={myTierLabel ? `${myTierLabel} · ${myDisplay}` : myDisplay}>
              <TierIcon tier={myTier} size="sm" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-semibold">{myDisplay}</div>
              {myTierLabel && <div className="truncate text-[10px] uppercase tracking-[0.16em]" style={{ color: myAccent ?? undefined }}>{myTierLabel}</div>}
            </div>
            <Button size="sm" variant="ghost" onClick={async () => { await signOut(); navigate({ to: "/login" }); }} title="Terminar sessão" className="h-8 w-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={async () => { await signOut(); navigate({ to: "/login" }); }} title="Terminar sessão" className="mx-auto h-8 w-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
