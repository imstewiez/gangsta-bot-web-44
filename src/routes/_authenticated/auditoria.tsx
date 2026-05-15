import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { isServer } from "@/lib/auth-helpers";
import { listAuditLogs } from "@/lib/ops.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { fmtDate } from "@/lib/domain";
import {
  Activity,
  ArrowUpCircle,
  ArrowDownCircle,
  UserMinus,
  UserPlus,
  Pencil,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  Truck,
  Package,
  Crosshair,
  Sparkles,
  Trophy,
  Settings2,
  AlertTriangle,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

const ACTION_META: Record<
  string,
  { label: string; icon: LucideIcon; tone: string }
> = {
  member_promoted: {
    label: "Promoção",
    icon: ArrowUpCircle,
    tone: "text-success",
  },
  member_demoted: {
    label: "Despromoção",
    icon: ArrowDownCircle,
    tone: "text-warning",
  },
  member_kicked: {
    label: "Expulsão",
    icon: UserMinus,
    tone: "text-destructive",
  },
  member_joined: {
    label: "Nova admissão",
    icon: UserPlus,
    tone: "text-success",
  },
  member_renamed: { label: "Renomeação", icon: Pencil, tone: "text-info" },
  member_tier_set: {
    label: "Tier alterado",
    icon: ArrowUpCircle,
    tone: "text-info",
  },
  member_stats_adjusted: {
    label: "Stats ajustadas",
    icon: Settings2,
    tone: "text-warning",
  },
  order_new: {
    label: "Encomenda criada",
    icon: ShoppingBag,
    tone: "text-info",
  },
  order_created: {
    label: "Encomenda criada",
    icon: ShoppingBag,
    tone: "text-info",
  },
  order_approved: {
    label: "Encomenda aceite",
    icon: CheckCircle2,
    tone: "text-success",
  },
  order_denied: {
    label: "Encomenda recusada",
    icon: XCircle,
    tone: "text-destructive",
  },
  order_fulfilled: {
    label: "Encomenda entregue",
    icon: CheckCircle2,
    tone: "text-success",
  },
  order_cancelled: {
    label: "Encomenda cancelada",
    icon: XCircle,
    tone: "text-muted-foreground",
  },
  delivery_created: {
    label: "Entrega registada",
    icon: Truck,
    tone: "text-success",
  },
  inventory_in: {
    label: "Entrada de stock",
    icon: Package,
    tone: "text-success",
  },
  inventory_out: {
    label: "Saída de stock",
    icon: Package,
    tone: "text-destructive",
  },
  operation_created: {
    label: "Saída planeada",
    icon: Crosshair,
    tone: "text-info",
  },
  operation_started: {
    label: "Saída iniciada",
    icon: Crosshair,
    tone: "text-warning",
  },
  operation_finalized: {
    label: "Saída finalizada",
    icon: CheckCircle2,
    tone: "text-success",
  },
  operation_closed: {
    label: "Saída fechada",
    icon: XCircle,
    tone: "text-muted-foreground",
  },
  prize_set: { label: "Prémio definido", icon: Sparkles, tone: "text-primary" },
  prize_delivered: {
    label: "Prémio entregue",
    icon: Trophy,
    tone: "text-success",
  },
  rankings_recompute: {
    label: "Ranking recalculado",
    icon: Activity,
    tone: "text-info",
  },
  tag_request: { label: "Pedido de tag", icon: ScrollText, tone: "text-info" },
  tag_approved: {
    label: "Tag aprovada",
    icon: CheckCircle2,
    tone: "text-success",
  },
  tag_denied: {
    label: "Tag recusada",
    icon: XCircle,
    tone: "text-destructive",
  },
};

function actionMeta(action: string) {
  return (
    ACTION_META[action] ?? {
      label: action.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()),
      icon: AlertTriangle,
      tone: "text-muted-foreground",
    }
  );
}

export const Route = createFileRoute("/_authenticated/auditoria")({
  beforeLoad: async () => {
    if (isServer()) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/login" });
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const MANAGER_ROLES = new Set(["patrao_di_zona", "real_gangster", "og", "kingpin", "manda_chuva", "admin"]);
    if (!(roles ?? []).some((r: { role: string }) => MANAGER_ROLES.has(r.role)))
      throw redirect({ to: "/dashboard" });
  },
  component: Page,
});

function Page() {
  const fn = useServerFn(listAuditLogs);
  const logs = useQuery({
    queryKey: ["auditLogs"],
    queryFn: () => fn({ data: { limit: 200 } }),
  });
  return (
    <>
      <PageHeader
        eyebrow="Direção"
        title="Auditoria"
        description="Registo operacional de todas as movimentações."
        icon={ScrollText}
      />
      <div className="overflow-x-auto overflow-hidden rounded-sm border border-border" style={{ maxHeight: "70vh", overflowY: "auto" }}>
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
              <tr>
                <td
                  colSpan={5}
                  className="p-6 text-center text-muted-foreground"
                >
                  A carregar…
                </td>
              </tr>
            )}
            {(logs.data ?? []).map((l) => {
              const meta = actionMeta(l.action);
              const Icon = meta.icon;
              return (
                <tr
                  key={l.id}
                  className="border-t border-border hover:bg-accent/30"
                >
                  <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                    {fmtDate(l.created_at)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        "inline-flex items-center gap-2 text-sm " + meta.tone
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="font-medium">{meta.label}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {l.entity_type ?? "—"}
                    {l.entity_id ? ` #${l.entity_id}` : ""}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {l.actor_name ?? l.actor_id ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground truncate max-w-md">
                    {l.context ?? ""}
                  </td>
                </tr>
              );
            })}
            {!logs.isLoading && !logs.data?.length && (
              <tr>
                <td
                  colSpan={5}
                  className="p-6 text-center text-muted-foreground"
                >
                  Sem registos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
