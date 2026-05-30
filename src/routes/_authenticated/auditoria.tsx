import { useState, useMemo } from "react";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { supabase } from "@/integrations/supabase/client";
import { isServer } from "@/lib/auth-helpers";
import { listAuditLogs, listAppLogs, getLogStats } from "@/lib/logging.functions";
import { checkManagerAccess } from "@/lib/access-check.functions";
import { Loader2 } from "lucide-react";
import { PageHeader } from "@/components/layout/AppShell";
import { fmtDate } from "@/lib/domain";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  Activity, ArrowUpCircle, ArrowDownCircle, UserMinus, UserPlus,
  Pencil, ShoppingBag, CheckCircle2, XCircle, Truck, Package,
  Crosshair, Sparkles, Trophy, Settings2, AlertTriangle, ScrollText,
  Shield, Ban, MessageSquare, HandCoins, Search, Filter, X,
  Bug, Terminal, BarChart3, type LucideIcon,
} from "lucide-react";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Reveal, Stagger } from "@/components/layout/Reveal";

/* ────────────── ACTION META ────────────── */
const ACTION_META: Record<string, { label: string; icon: LucideIcon; tone: string; category: string }> = {
  member_promoted:       { label: "Promoção", icon: ArrowUpCircle, tone: "text-emerald-400", category: "membro" },
  member_demoted:        { label: "Despromoção", icon: ArrowDownCircle, tone: "text-amber-400", category: "membro" },
  member_kicked:         { label: "Expulsão", icon: UserMinus, tone: "text-red-400", category: "membro" },
  member_joined:         { label: "Nova admissão", icon: UserPlus, tone: "text-emerald-400", category: "membro" },
  member_left:           { label: "Saiu do servidor", icon: UserMinus, tone: "text-muted-foreground", category: "membro" },
  member_renamed:        { label: "Renomeação", icon: Pencil, tone: "text-blue-400", category: "membro" },
  member_tier_set:       { label: "Cargo alterado", icon: ArrowUpCircle, tone: "text-blue-400", category: "membro" },
  member_stats_adjusted: { label: "Estatísticas ajustadas", icon: Settings2, tone: "text-amber-400", category: "membro" },

  order_new:             { label: "Encomenda criada", icon: ShoppingBag, tone: "text-blue-400", category: "encomenda" },
  order_created:         { label: "Encomenda criada", icon: ShoppingBag, tone: "text-blue-400", category: "encomenda" },
  order_approved:        { label: "Encomenda aceite", icon: CheckCircle2, tone: "text-emerald-400", category: "encomenda" },
  order_denied:          { label: "Encomenda recusada", icon: XCircle, tone: "text-red-400", category: "encomenda" },
  order_fulfilled:       { label: "Encomenda entregue", icon: CheckCircle2, tone: "text-emerald-400", category: "encomenda" },
  order_cancelled:       { label: "Encomenda cancelada", icon: Ban, tone: "text-muted-foreground", category: "encomenda" },

  delivery_created:      { label: "Entrega registada", icon: Truck, tone: "text-emerald-400", category: "entrega" },
  delivery_approved:     { label: "Entrega aprovada", icon: CheckCircle2, tone: "text-emerald-400", category: "entrega" },
  delivery_request_created:   { label: "Pedido de entrega", icon: Truck, tone: "text-blue-400", category: "entrega" },
  delivery_request_approved:  { label: "Entrega aprovada", icon: CheckCircle2, tone: "text-emerald-400", category: "entrega" },

  inventory_in:          { label: "Entrada de stock", icon: Package, tone: "text-emerald-400", category: "stock" },
  inventory_out:         { label: "Saída de stock", icon: Package, tone: "text-red-400", category: "stock" },
  bairrista_submission:  { label: "Submissão bairrista", icon: HandCoins, tone: "text-blue-400", category: "stock" },

  operation_created:     { label: "Saída planeada", icon: Crosshair, tone: "text-blue-400", category: "saída" },
  operation_started:     { label: "Saída iniciada", icon: Crosshair, tone: "text-amber-400", category: "saída" },
  operation_finalized:   { label: "Saída finalizada", icon: CheckCircle2, tone: "text-emerald-400", category: "saída" },
  operation_closed:      { label: "Saída fechada", icon: XCircle, tone: "text-muted-foreground", category: "saída" },

  prize_set:             { label: "Prémio definido", icon: Sparkles, tone: "text-primary", category: "prémio" },
  prize_delivered:       { label: "Prémio entregue", icon: Trophy, tone: "text-emerald-400", category: "prémio" },

  rankings_recompute:    { label: "Classificação recalculada", icon: Activity, tone: "text-blue-400", category: "sistema" },

  tag_request:           { label: "Pedido de tag", icon: MessageSquare, tone: "text-blue-400", category: "tag" },
  tag_approved:          { label: "Tag aprovada", icon: CheckCircle2, tone: "text-emerald-400", category: "tag" },
  tag_denied:            { label: "Tag recusada", icon: XCircle, tone: "text-red-400", category: "tag" },
};

function actionMeta(action: string) {
  return (
    ACTION_META[action] ?? {
      label: action.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
      icon: AlertTriangle,
      tone: "text-muted-foreground",
      category: "outro",
    }
  );
}

const CATEGORIES = [
  { key: "todos", label: "Tudo" },
  { key: "membro", label: "Membros" },
  { key: "encomenda", label: "Encomendas" },
  { key: "entrega", label: "Entregas" },
  { key: "stock", label: "Stock" },
  { key: "saída", label: "Saídas" },
  { key: "prémio", label: "Prémios" },
  { key: "tag", label: "Tags" },
  { key: "sistema", label: "Sistema" },
  { key: "outro", label: "Outro" },
];

/* ────────────── ENTITY RESOLVER ────────────── */
function resolveEntity(type: string | null, id: string | null, ctx: string | null): { title: string; subtitle: string } {
  if (!type || !id) return { title: "—", subtitle: "" };

  // Member
  if (type === "member") {
    const name = ctx?.match(/^(.*?)\s*\(/)?.[1] || ctx?.split(" ")[0] || "";
    return { title: name || `Membro #${id.slice(0, 8)}`, subtitle: `Discord: ${id}` };
  }

  // Inventory / Delivery
  if (type.includes("inventory") || type.includes("delivery")) {
    const itemName = ctx?.match(/\d+\s+De\s+(.+?)\s+(entregue|confirmado)/i)?.[1];
    return { title: itemName || type.replace(/_/g, " "), subtitle: `ID: ${id.slice(0, 16)}` };
  }

  // Order
  if (type === "order") {
    return { title: `Encomenda #${id}`, subtitle: "" };
  }

  // Operation
  if (type.includes("operation")) {
    return { title: `Saída #${id}`, subtitle: "" };
  }

  return { title: `${type} #${id.slice(0, 16)}`, subtitle: "" };
}

/* ────────────── CONTEXT PARSER ────────────── */
function parseContext(ctx: string | null): { text: string; tags: string[] } {
  if (!ctx) return { text: "", tags: [] };

  const tags: string[] = [];
  let text = ctx;

  // Extract Discord mentions
  text = text.replace(/<@(\d+)>/g, (_, id) => {
    tags.push(`@${id.slice(0, 8)}…`);
    return "";
  });

  // Extract amounts
  text = text.replace(/(\d+)\s*De\s+([\w\s]+)/gi, (_, qty, item) => {
    tags.push(`${qty}× ${item.trim()}`);
    return "";
  });

  // Clean up
  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(/^Confirmado por\s*/i, "").trim();
  text = text.replace(/^—\s*/g, "").trim();

  return { text, tags };
}

/* ────────────── ROUTE ────────────── */
export const Route = createFileRoute("/_authenticated/auditoria")({
  beforeLoad: async () => {
    if (isServer()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
  },
  head: () => ({
    meta: [{ title: "Auditoria | Ballas Gang" }],
  }),
  component: Page,
});

/* ────────────── PAGE ────────────── */
function Page() {
  useRealtimeSync([
    { table: "audit_logs", queryKeys: [["auditLogs"], ["appLogs"], ["logStats"]] },
    { table: "app_logs", queryKeys: [["appLogs"], ["logStats"]] },
  ]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("todos");
  const [activeTab, setActiveTab] = useState("acoes");

  const auditFn = useAuthedServerFn(listAuditLogs);
  const appFn = useAuthedServerFn(listAppLogs);
  const statsFn = useAuthedServerFn(getLogStats);

  const auditLogs = useQuery({ queryKey: ["auditLogs"], queryFn: () => auditFn() });
  const appLogs = useQuery({ queryKey: ["appLogs"], queryFn: () => appFn() });
  const stats = useQuery({ queryKey: ["logStats"], queryFn: () => statsFn() });

  const filteredAudit = useMemo(() => {
    let list = auditLogs.data ?? [];
    if (category !== "todos") {
      list = list.filter((l: any) => actionMeta(l.action).category === category);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l: any) =>
        (l.action?.toLowerCase().includes(q) ?? false) ||
        (l.actor_name?.toLowerCase().includes(q) ?? false) ||
        (l.actor_id?.toLowerCase().includes(q) ?? false) ||
        (l.context?.toLowerCase().includes(q) ?? false) ||
        (l.entity_type?.toLowerCase().includes(q) ?? false) ||
        (l.entity_id?.toLowerCase().includes(q) ?? false)
      );
    }
    return list;
  }, [auditLogs.data, search, category]);

  const filteredApp = useMemo(() => {
    let list = appLogs.data ?? [];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l: any) =>
        (l.message?.toLowerCase().includes(q) ?? false) ||
        (l.category?.toLowerCase().includes(q) ?? false) ||
        (l.source?.toLowerCase().includes(q) ?? false)
      );
    }
    return list;
  }, [appLogs.data, search]);

  // Group by date
  const groupedAudit = useMemo(() => {
    const map = new Map<string, typeof filteredAudit>();
    for (const l of filteredAudit) {
      const date = l.created_at.slice(0, 10);
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(l);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredAudit]);

  const groupedApp = useMemo(() => {
    const map = new Map<string, typeof filteredApp>();
    for (const l of filteredApp) {
      const date = l.created_at.slice(0, 10);
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(l);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredApp]);

  function dateLabel(iso: string): string {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    if (iso === today) return "Hoje";
    if (iso === yesterday) return "Ontem";
    const d = new Date(iso);
    return d.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" });
  }

  const s = stats.data;

  return (
    <>
      <PageHeader eyebrow="Direção" title="Auditoria" description="Histórico de ações e logs do sistema" icon={ScrollText} />

      {/* Stats */}
      <Reveal direction="up" delay={50}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Card className="interactive-card">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <ScrollText className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-lg font-bold leading-none">{s?.totalAudit ?? 0}</div>
                <div className="text-[11px] text-muted-foreground">Ações registadas</div>
              </div>
            </CardContent>
          </Card>
          <Card className="interactive-card">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="rounded-lg bg-blue-500/10 p-2">
                <Terminal className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <div className="text-lg font-bold leading-none">{s?.totalApp ?? 0}</div>
                <div className="text-[11px] text-muted-foreground">Logs técnicos</div>
              </div>
            </CardContent>
          </Card>
          <Card className="interactive-card">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="rounded-lg bg-red-500/10 p-2">
                <Bug className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <div className="text-lg font-bold leading-none">{s?.errors24h ?? 0}</div>
                <div className="text-[11px] text-muted-foreground">Erros 24h</div>
              </div>
            </CardContent>
          </Card>
          <Card className="interactive-card">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="rounded-lg bg-amber-500/10 p-2">
                <BarChart3 className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <div className="text-lg font-bold leading-none">{s?.errors7d ?? 0}</div>
                <div className="text-[11px] text-muted-foreground">Erros 7 dias</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </Reveal>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="acoes" className="interactive-tab">
            <Shield className="mr-1.5 h-3.5 w-3.5" /> Ações Chefia
          </TabsTrigger>
          <TabsTrigger value="erros" className="interactive-tab">
            <Bug className="mr-1.5 h-3.5 w-3.5" /> Erros do Sistema
          </TabsTrigger>
        </TabsList>

        <TabsContent value="acoes" className="space-y-4">
          {/* Filters */}
          <Reveal direction="up">
            <div className="mb-4 space-y-3">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Procurar por ação, membro, entidade..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setCategory(c.key)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      category === c.key
                        ? "border-primary bg-primary/20 text-primary"
                        : "border-border bg-card/40 text-muted-foreground hover:bg-card/80 hover:text-foreground"
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <div className="text-xs text-muted-foreground">
                {filteredAudit.length} de {(auditLogs.data ?? []).length} registos
              </div>
            </div>
          </Reveal>

          {/* Audit Logs */}
          <div className="space-y-6">
            {auditLogs.isLoading && (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-card/40" style={{ animationDelay: `${i * 100}ms` }} />
                ))}
              </div>
            )}

            {groupedAudit.map(([date, items], gIdx) => (
              <Reveal key={date} direction="up" delay={gIdx * 80}>
                <section>
                  <h3 className="mb-2 text-display text-xs font-bold uppercase tracking-wider text-muted-foreground/70">
                    {dateLabel(date)}
                  </h3>
                  <Stagger className="space-y-2" staggerDelay={60}>
                    {items.map((l: any) => {
                      const meta = actionMeta(l.action);
                      const Icon = meta.icon;
                      const entity = resolveEntity(l.entity_type, l.entity_id, l.context);
                      const parsed = parseContext(l.context);
                      const time = new Date(l.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });

                      return (
                        <div
                          key={l.id}
                          className="flex items-start gap-3 rounded-xl border border-border bg-card/60 p-3 backdrop-blur-sm interactive-card"
                        >
                          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", meta.tone.replace("text-", "border-").replace("400", "500/30"), meta.tone.replace("text-", "bg-").replace("400", "500/10"))}>
                            <Icon className={cn("h-4 w-4", meta.tone)} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className={cn("text-sm font-semibold", meta.tone)}>{meta.label}</span>
                              <span className="text-xs text-muted-foreground">• {time}</span>
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              Por <span className="text-foreground font-medium">{l.actor_name ?? l.actor_id ?? "Sistema"}</span>
                            </div>
                            {entity.title !== "—" && (
                              <div className="mt-1 text-xs">
                                <span className="text-muted-foreground">Sobre: </span>
                                <span className="text-foreground font-medium">{entity.title}</span>
                                {entity.subtitle && <span className="text-muted-foreground/70"> ({entity.subtitle})</span>}
                              </div>
                            )}
                            {parsed.tags.length > 0 && (
                              <div className="mt-1.5 flex flex-wrap gap-1">
                                {parsed.tags.map((tag: string, i: number) => (
                                  <span key={i} className="inline-flex items-center rounded-sm bg-secondary/50 px-1.5 py-0.5 text-[10px] font-medium text-foreground">{tag}</span>
                                ))}
                              </div>
                            )}
                            {parsed.text && (
                              <div className="mt-1 text-xs text-muted-foreground/80 italic">{parsed.text}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </Stagger>
                </section>
              </Reveal>
            ))}

            {!auditLogs.isLoading && !filteredAudit.length && (
              <div className="rounded-xl border border-dashed border-border/50 bg-card/30 py-12 text-center">
                <ScrollText className="mx-auto h-10 w-10 text-muted-foreground/30" />
                <p className="mt-2 text-sm text-muted-foreground">Sem registos.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="erros" className="space-y-4">
          <Reveal direction="up">
            <div className="mb-4 space-y-3">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Procurar erro, categoria, source..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {filteredApp.length} de {(appLogs.data ?? []).length} registos
              </div>
            </div>
          </Reveal>

          <div className="space-y-6">
            {appLogs.isLoading && (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-card/40" style={{ animationDelay: `${i * 100}ms` }} />
                ))}
              </div>
            )}

            {groupedApp.map(([date, items], gIdx) => (
              <Reveal key={date} direction="up" delay={gIdx * 80}>
                <section>
                  <h3 className="mb-2 text-display text-xs font-bold uppercase tracking-wider text-muted-foreground/70">
                    {dateLabel(date)}
                  </h3>
                  <Stagger className="space-y-2" staggerDelay={60}>
                    {items.map((l: any) => {
                      const time = new Date(l.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
                      const levelColor = l.level === "error" || l.level === "fatal" ? "text-red-400" : l.level === "warn" ? "text-amber-400" : "text-blue-400";
                      const levelBg = l.level === "error" || l.level === "fatal" ? "bg-red-500/10 border-red-500/30" : l.level === "warn" ? "bg-amber-500/10 border-amber-500/30" : "bg-blue-500/10 border-blue-500/30";

                      return (
                        <div key={l.id} className="flex items-start gap-3 rounded-xl border border-border bg-card/60 p-3 backdrop-blur-sm interactive-card">
                          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", levelBg)}>
                            <Bug className={cn("h-4 w-4", levelColor)} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span className={cn("text-sm font-semibold", levelColor)}>{l.message}</span>
                              <span className="text-xs text-muted-foreground">• {time}</span>
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {l.category} / {l.source} / <span className="font-mono">{l.level.toUpperCase()}</span>
                            </div>
                            {l.error_stack && (
                              <details className="mt-1.5">
                                <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">Stack trace</summary>
                                <pre className="mt-1 max-h-40 overflow-auto rounded-md bg-muted/50 p-2 text-[10px] text-muted-foreground">{l.error_stack}</pre>
                              </details>
                            )}
                            {l.metadata && Object.keys(l.metadata).length > 0 && (
                              <div className="mt-1 text-[10px] text-muted-foreground/70 font-mono">
                                {JSON.stringify(l.metadata).slice(0, 200)}
                                {JSON.stringify(l.metadata).length > 200 ? "..." : ""}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </Stagger>
                </section>
              </Reveal>
            ))}

            {!appLogs.isLoading && !filteredApp.length && (
              <div className="rounded-xl border border-dashed border-border/50 bg-card/30 py-12 text-center">
                <Bug className="mx-auto h-10 w-10 text-muted-foreground/30" />
                <p className="mt-2 text-sm text-muted-foreground">Sem logs técnicos.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
