import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { listAuditLogs } from "@/lib/ops.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { fmtDate, formatAuditAction } from "@/lib/domain";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { TableRowsSkeleton } from "@/components/ui/table-skeleton";
import {
  Activity, ArrowUpCircle, ArrowDownCircle, UserMinus, UserPlus,
  Pencil, ShoppingBag, CheckCircle2, XCircle, Truck, Package,
  Crosshair, Sparkles, Trophy, Settings2, AlertTriangle, ScrollText,
  Filter, X,
  type LucideIcon,
} from "lucide-react";

const ACTION_META: Record<string, { label: string; icon: LucideIcon; tone: string }> = {
  member_promoted:    { label: "Promoção",            icon: ArrowUpCircle,   tone: "text-success" },
  member_demoted:     { label: "Despromoção",         icon: ArrowDownCircle, tone: "text-warning" },
  member_kicked:      { label: "Expulsão",            icon: UserMinus,       tone: "text-destructive" },
  member_joined:      { label: "Entrada no bairro",   icon: UserPlus,        tone: "text-success" },
  member_renamed:     { label: "Renomeação",          icon: Pencil,          tone: "text-info" },
  member_tier_set:    { label: "Tier alterado",       icon: ArrowUpCircle,   tone: "text-info" },
  member_stats_adjusted: { label: "Stats ajustadas",  icon: Settings2,       tone: "text-warning" },
  order_new:          { label: "Encomenda criada",    icon: ShoppingBag,     tone: "text-info" },
  order_created:      { label: "Encomenda criada",    icon: ShoppingBag,     tone: "text-info" },
  order_approved:     { label: "Encomenda aceite",    icon: CheckCircle2,    tone: "text-success" },
  order_denied:       { label: "Encomenda recusada",  icon: XCircle,         tone: "text-destructive" },
  order_fulfilled:    { label: "Encomenda entregue",  icon: CheckCircle2,    tone: "text-success" },
  order_cancelled:    { label: "Encomenda cancelada", icon: XCircle,         tone: "text-muted-foreground" },
  delivery_created:   { label: "Entrega registada",   icon: Truck,           tone: "text-success" },
  inventory_in:       { label: "Entrada de stock",    icon: Package,         tone: "text-success" },
  inventory_out:      { label: "Saída de stock",      icon: Package,         tone: "text-destructive" },
  operation_created:  { label: "Saída planeada",      icon: Crosshair,       tone: "text-info" },
  operation_started:  { label: "Saída iniciada",      icon: Crosshair,       tone: "text-warning" },
  operation_finalized:{ label: "Saída finalizada",    icon: CheckCircle2,    tone: "text-success" },
  operation_closed:   { label: "Saída fechada",       icon: XCircle,         tone: "text-muted-foreground" },
  prize_set:          { label: "Prémio definido",     icon: Sparkles,        tone: "text-primary" },
  prize_delivered:    { label: "Prémio entregue",     icon: Trophy,          tone: "text-success" },
  rankings_recompute: { label: "Ranking recalculado", icon: Activity,        tone: "text-info" },
  tag_request:        { label: "Pedido de tag",       icon: ScrollText,      tone: "text-info" },
  tag_approved:       { label: "Tag aprovada",        icon: CheckCircle2,    tone: "text-success" },
  tag_denied:         { label: "Tag recusada",        icon: XCircle,         tone: "text-destructive" },
};

function actionMeta(action: string) {
  return (
    ACTION_META[action] ?? {
      label: formatAuditAction(action),
      icon: AlertTriangle,
      tone: "text-muted-foreground",
    }
  );
}

export const Route = createFileRoute("/_authenticated/auditoria")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    if (!(roles ?? []).some((r: { role: string }) => r.role === "admin")) throw redirect({ to: "/dashboard" });
  },
  component: Page,
});

function Page() {
  const fn = useServerFn(listAuditLogs);
  const logs = useQuery({ queryKey: ["auditLogs"], queryFn: () => fn({ data: { limit: 200 } }) });

  const [actionFilter, setActionFilter] = useState<string>("todas");
  const [actorFilter, setActorFilter] = useState<string>("");

  const allActions = useMemo(() => {
    const set = new Set<string>();
    (logs.data ?? []).forEach((l) => set.add(l.action));
    return Array.from(set).sort();
  }, [logs.data]);

  const filtered = useMemo(() => {
    const q = actorFilter.trim().toLowerCase();
    return (logs.data ?? []).filter((l) => {
      if (actionFilter !== "todas" && l.action !== actionFilter) return false;
      if (q) {
        const hay = `${l.actor_name ?? ""} ${l.actor_id ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [logs.data, actionFilter, actorFilter]);

  const hasFilters = actionFilter !== "todas" || actorFilter.trim().length > 0;

  return (
    <>
      <PageHeader eyebrow="Chefia" title="Auditoria" description="Tudo o que se mexe no bairro fica aqui." icon={ScrollText} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> Filtros
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="h-8 w-56 text-xs">
            <SelectValue placeholder="Todas as acções" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as acções</SelectItem>
            {allActions.map((a) => (
              <SelectItem key={a} value={a}>{actionMeta(a).label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Filtrar por actor…"
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
          className="h-8 w-56 text-xs"
        />
        {hasFilters && (
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs text-muted-foreground"
            onClick={() => { setActionFilter("todas"); setActorFilter(""); }}
          >
            <X className="mr-1 h-3.5 w-3.5" /> Limpar
          </Button>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "registo" : "registos"}
          {hasFilters && logs.data ? ` de ${logs.data.length}` : ""}
        </span>
      </div>

      <div className="overflow-hidden rounded-sm border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-display text-[11px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left">Quando</th>
              <th className="px-3 py-2 text-left">Acção</th>
              <th className="px-3 py-2 text-left">Entidade</th>
              <th className="px-3 py-2 text-left">Actor</th>
              <th className="px-3 py-2 text-left">Contexto</th>
            </tr>
          </thead>
          <tbody>
            {logs.isLoading && (
              <TableRowsSkeleton rows={10} cols={5} widths={["w-28", "w-32", "w-24", "w-24", "w-48"]} />
            )}
            {filtered.map((l) => {
              const meta = actionMeta(l.action);
              const Icon = meta.icon;
              return (
                <tr key={l.id} className="border-t border-border hover:bg-accent/30">
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(l.created_at)}</td>
                  <td className="px-3 py-2">
                    <span className={"inline-flex items-center gap-2 text-sm " + meta.tone}>
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="font-medium">{meta.label}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{l.entity_type ?? "—"}{l.entity_id ? ` #${l.entity_id}` : ""}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{l.actor_name ?? l.actor_id ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-md">{l.context ?? ""}</td>
                </tr>
              );
            })}
            {!logs.isLoading && !filtered.length && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">
                {hasFilters ? "Nenhum registo bate com os filtros." : "Sem registos."}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
