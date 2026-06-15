import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Database,
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
  X,
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
  { label: "Inventário", items: [{ to: "/precario", label: "Preçário", icon: Tags }, { to: "/inventario", label: "Inventário", icon: Package, need: "inventory" }] },
  { label: "Gestão", items: [{ to: "/admin/dashboard", label: "Painel", icon: Activity, admin: true }, { to: "/admin/itens", label: "Itens", icon: Package, admin: true }, { to: "/admin/dados", label: "Dados", icon: Database, admin: true }, { to: "/admin", label: "Definições", icon: Shield, admin: true }, { to: "/auditoria", label: "Auditoria", icon: ScrollText, admin: true }] },
];

export function AppSidebar() {
  const { state, setOpenMobile } = useSidebar();
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

  const closeMobile = () => setOpenMobile(false);
  const visibleGroups = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((it) => {
      if (it.admin && !(me.data?.is_manager ?? false)) return false;
      if (it.need === "inventory" && !canSeeInv) return false;
      return true;
    }),
  })).filter((group) => group.items.length > 0);

  async function logout() {
    await signOut();
    navigate({ to: "/login" });
  }

  return (
    <>
      <div className="app-sidebar-desktop">
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
            {visibleGroups.map((g) => (
              <SidebarGroup key={g.label} className="px-0 py-1.5">
                {!collapsed && <SidebarGroupLabel className="h-7 px-2 text-[10px] tracking-[0.3em] font-display text-sidebar-foreground/48">{g.label}</SidebarGroupLabel>}
                <SidebarGroupContent>
                  <SidebarMenu className="gap-1.5">
                    {g.items.map((it) => {
                      const active = isActive(it.to);
                      return (
                        <SidebarMenuItem key={it.to}>
                          <SidebarMenuButton asChild isActive={active} tooltip={it.label} className="h-9 rounded-xl border border-transparent text-sidebar-foreground/74 hover:border-primary/30 hover:bg-primary/10 hover:text-primary data-[active=true]:border-primary/35 data-[active=true]:bg-primary/16 data-[active=true]:text-primary">
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
            ))}
          </SidebarContent>

          <SidebarFooter className={cn("relative z-10", collapsed ? "p-1" : "p-2")}>
            {!collapsed ? (
              <div className="sidebar-liquid-card flex items-center gap-2 rounded-2xl p-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border bg-background/40" style={{ borderColor: myAccent ? `color-mix(in oklab, ${myAccent} 55%, transparent)` : undefined }}>
                  <TierIcon tier={myTier} size="sm" />
                </span>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="truncate text-sm font-semibold">{myDisplay}</div>
                  {myTierLabel && <div className="truncate text-[10px] uppercase tracking-[0.16em]" style={{ color: myAccent ?? undefined }}>{myTierLabel}</div>}
                </div>
                <Button size="sm" variant="ghost" onClick={logout} title="Terminar sessão" className="h-8 w-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" onClick={logout} title="Terminar sessão" className="mx-auto h-8 w-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </SidebarFooter>
        </Sidebar>
      </div>

      <MobileNavDrawer groups={visibleGroups} isActive={isActive} closeMobile={closeMobile} logout={logout} myTier={myTier} myTierLabel={myTierLabel} myAccent={myAccent} myDisplay={myDisplay} />
    </>
  );
}

function MobileNavDrawer({ groups, isActive, closeMobile, logout, myTier, myTierLabel, myAccent, myDisplay }: { groups: NavGroup[]; isActive: (to: string) => boolean; closeMobile: () => void; logout: () => Promise<void>; myTier: string | null; myTierLabel: string | null; myAccent: string | null | undefined; myDisplay: string }) {
  const { openMobile } = useSidebar();

  return (
    <div className="app-mobile-nav">
      {openMobile && <button type="button" aria-label="Fechar menu" onClick={closeMobile} className="app-mobile-nav__overlay" />}
      <aside className={cn("app-mobile-nav__drawer app-sidebar-liquid", openMobile && "is-open")}>
        <button type="button" aria-label="Fechar menu" onClick={closeMobile} className="app-mobile-nav__close">
          <X className="h-4 w-4" />
        </button>

        <div className="relative z-10 flex items-center gap-2 p-3 pr-12">
          <Link to="/dashboard" onClick={closeMobile} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl">
            <img src={ballasLogo} alt="Ballas Gang" className="logo-hd h-9 w-9 rounded-sm object-contain" />
          </Link>
          <div className="min-w-0 text-display text-sm tracking-[0.2em]"><span className="bg-gradient-to-b from-primary to-blood bg-clip-text text-transparent">Ballas</span> Gang</div>
        </div>

        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {groups.map((group) => (
            <div key={group.label} className="py-1.5">
              <div className="h-7 px-2 text-[10px] tracking-[0.3em] font-display text-sidebar-foreground/48">{group.label}</div>
              <div className="space-y-1.5">
                {group.items.map((it) => {
                  const active = isActive(it.to);
                  return (
                    <Link key={it.to} to={it.to} onClick={closeMobile} className={cn("flex h-10 items-center gap-2.5 rounded-xl border px-3 text-sidebar-foreground/78 transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary", active ? "border-primary/35 bg-primary/16 text-primary" : "border-transparent")}>
                      <it.icon className="h-4 w-4 shrink-0" />
                      <span className="text-display text-[12px] tracking-[0.1em]">{it.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="relative z-10 p-2">
          <div className="sidebar-liquid-card flex items-center gap-2 rounded-2xl p-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border bg-background/40" style={{ borderColor: myAccent ? `color-mix(in oklab, ${myAccent} 55%, transparent)` : undefined }}>
              <TierIcon tier={myTier} size="sm" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-semibold">{myDisplay}</div>
              {myTierLabel && <div className="truncate text-[10px] uppercase tracking-[0.16em]" style={{ color: myAccent ?? undefined }}>{myTierLabel}</div>}
            </div>
            <Button size="sm" variant="ghost" onClick={logout} title="Terminar sessão" className="h-8 w-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}
