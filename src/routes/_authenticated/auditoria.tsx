import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { supabase } from "@/integrations/supabase/client";
import { isServer } from "@/lib/auth-helpers";
import { listAuditLogs } from "@/lib/ops.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { fmtDate } from "@/lib/domain";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Activity, ArrowUpCircle, ArrowDownCircle, UserMinus, UserPlus,
  Pencil, ShoppingBag, CheckCircle2, XCircle, Truck, Package,
  Crosshair, Sparkles, Trophy, Settings2, AlertTriangle, ScrollText,
  Shield, Ban, MessageSquare, HandCoins, Search, Filter, X,
  type LucideIcon,
} from "lucide-react";

/* ────────────── ACTION META ────────────── */
const ACTION_META: Record<string, { label: string; icon: LucideIcon; tone: string; category: string }> = {
  member_promoted:       { label: "Promoção", icon: ArrowUpCircle, tone: "text-emerald-400", category: "membro" },
  member_demoted:        { label: "Despromoção", icon: ArrowDownCircle, tone: "text-amber-400", category: "membro" },
  member_kicked:         { label: "Expulsão", icon: UserMinus, tone: "text-red-400", category: "membro" },
  member_joined:         { label: "Nova admissão", icon: UserPlus, tone: "text-emerald-400", category: "membro" },
  member_left:           { label: "Saiu do servidor", icon: UserMinus, tone: "text-muted-foreground", category: "membro" },
  member_renamed:        { label: "Renomeação", icon: Pencil, tone: "text-blue-400", category: "membro" },
  member_tier_set:       { label: "Tier alterado", icon: ArrowUpCircle, tone: "text-blue-400", category: "membro" },
  member_stats_adjusted: { label: "Stats ajustados", icon: Settings2, tone: "text-amber-400", category: "membro" },

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

  rankings_recompute:    { label: "Ranking recalculado", icon: Activity, tone: "text-blue-400", category: "sistema" },

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
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const MANAGER_ROLES = new Set(["patrao_di_zona", "real_gangster", "og", "kingpin", "manda_chuva", "admin"]);
    if (!(roles ?? []).some((r: { role: string }) => MANAGER_ROLES.has(r.role)))
      throw redirect({ to: "/dashboard" });
  },
  component: Page,
});

/* ────────────── PAGE ────────────── */
function Page() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("todos");
  const fn = useAuthedServerFn(listAuditLogs);
  const logs = useQuery({ queryKey: ["auditLogs"], queryFn: () => fn({ data: { limit: 300 } }) });

  const filtered = useMemo(() => {
    let list = logs.data ?? [];
    if (category !== "todos") {
      list = list.filter((l) => actionMeta(l.action).category === category);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l) =>
        (l.action?.toLowerCase().includes(q) ?? false) ||
        (l.actor_name?.toLowerCase().includes(q) ?? false) ||
        (l.actor_id?.toLowerCase().includes(q) ?? false) ||
        (l.context?.toLowerCase().includes(q) ?? false) ||
        (l.entity_type?.toLowerCase().includes(q) ?? false) ||
        (l.entity_id?.toLowerCase().includes(q) ?? false)
      );
    }
    return list;
  }, [logs.data, search, category]);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const l of filtered) {
      const date = l.created_at.slice(0, 10); // YYYY-MM-DD
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(l);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  function dateLabel(iso: string): string {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
    if (iso === today) return "Hoje";
    if (iso === yesterday) return "Ontem";
    const d = new Date(iso);
    return d.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long" });
  }

  return (
    <>
      <PageHeader eyebrow="Direção" title="Auditoria" description="Histórico de ações" icon={ScrollText} />

      {/* Filters */}
      <div className="mb-4 space-y-3">
        {/* Search */}
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

        {/* Category pills */}
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

        {/* Result count */}
        <div className="text-xs text-muted-foreground">
          {filtered.length} de {(logs.data ?? []).length} registos
        </div>
      </div>

      {/* Logs */}
      <div className="space-y-6">
        {logs.isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-card/40" style={{ animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        )}

        {grouped.map(([date, items]) => (
          <section key={date}>
            <h3 className="mb-2 text-display text-xs font-bold uppercase tracking-wider text-muted-foreground/70">
              {dateLabel(date)}
            </h3>
            <div className="space-y-2">
              {items.map((l) => {
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
                    {/* Icon */}
                    <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", meta.tone.replace("text-", "border-").replace("400", "500/30"), meta.tone.replace("text-", "bg-").replace("400", "500/10"))}>
                      <Icon className={cn("h-4 w-4", meta.tone)} />
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className={cn("text-sm font-semibold", meta.tone)}>{meta.label}</span>
                        <span className="text-xs text-muted-foreground">• {time}</span>
                      </div>

                      {/* Actor */}
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Por{" "}
                        <span className="text-foreground font-medium">
                          {l.actor_name ?? l.actor_id ?? "Sistema"}
                        </span>
                      </div>

                      {/* Entity */}
                      {entity.title !== "—" && (
                        <div className="mt-1 text-xs">
                          <span className="text-muted-foreground">Sobre: </span>
                          <span className="text-foreground font-medium">{entity.title}</span>
                          {entity.subtitle && (
                            <span className="text-muted-foreground/70"> ({entity.subtitle})</span>
                          )}
                        </div>
                      )}

                      {/* Context tags */}
                      {parsed.tags.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {parsed.tags.map((tag, i) => (
                            <span key={i} className="inline-flex items-center rounded-sm bg-secondary/50 px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Context text */}
                      {parsed.text && (
                        <div className="mt-1 text-xs text-muted-foreground/80 italic">
                          {parsed.text}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {!logs.isLoading && !filtered.length && (
          <div className="rounded-xl border border-dashed border-border/50 bg-card/30 py-12 text-center">
            <ScrollText className="mx-auto h-10 w-10 text-muted-foreground/30" />
            <p className="mt-2 text-sm text-muted-foreground">Sem registos.</p>
          </div>
        )}
      </div>
    </>
  );
}
