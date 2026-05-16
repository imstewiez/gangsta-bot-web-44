import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { getMember } from "@/lib/members.functions";
import { getCurrentMember } from "@/lib/pricing.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtNum, fmtDate, ROLE_LABELS, POSITION_LABELS, TIER_ORDER } from "@/lib/domain";
import { MemberIdentity } from "@/components/domain/RoleBadge";
import { MemberAdminPanel } from "@/components/domain/MemberAdminPanel";
import {
  Skull,
  Crosshair,
  Truck,
  Coins,
  ShoppingBag,
  Package,
  Sword,
  ArrowDownUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/membros/$id")({
  component: Page,
});

function Page() {
  useRealtimeSync(["members"]);
  const { id } = Route.useParams();
  const fn = useAuthedServerFn(getMember);
  const meFn = useAuthedServerFn(getCurrentMember);
  const { data, isLoading } = useQuery({
    queryKey: ["member", id],
    queryFn: () => fn({ data: { id: Number(id) } }),
  });
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => meFn(),
    staleTime: 60_000,
  });
  if (isLoading) return <p className="text-muted-foreground">A carregar…</p>;
  if (!data?.member)
    return (
      <p>
        Membro não encontrado.{" "}
        <Link to="/membros" className="text-primary">
          Voltar
        </Link>
      </p>
    );
  const m = data.member;
  const isChefia = me.data?.is_manager ?? false;
  const myTier = me.data?.tier ?? null;

  function tierRank(t: string | null) {
    if (!t) return -1;
    return TIER_ORDER.indexOf(t);
  }
  const canManage = isChefia && tierRank(myTier) > tierRank(m.tier);

  return (
    <>
      <PageHeader
        eyebrow={POSITION_LABELS[m.tier ?? "bairrista"]}
        title={m.display_name ?? "—"}
        description={m.nick ? `"${m.nick}"` : undefined}
        action={<MemberIdentity tier={m.tier} size="md" />}
      />

      {/* Stats grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Sword} label="Kills" value={data.kills} tone="primary" />
        <StatCard icon={Skull} label="Mortes" value={data.deaths} tone="destructive" />
        <StatCard icon={Crosshair} label="Saídas" value={data.saidas} tone="info" />
        <StatCard icon={Truck} label="Entregas" value={data.deliveries} tone="success" />
        <StatCard icon={Coins} label="Vendas" value={data.vendas} tone="warning" />
        <StatCard icon={ShoppingBag} label="Encomendas" value={data.orders} tone="accent" />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-display text-[11px] uppercase tracking-wider text-muted-foreground">Entrou</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{fmtDate(m.joined_at)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-display text-[11px] uppercase tracking-wider text-muted-foreground">Discord ID</CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-xs">{m.discord_id ?? "—"}</CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-display text-sm">Contribuições</CardTitle>
          </CardHeader>
          <CardContent>
            {(data.contributions?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Sem registos.</p>
            ) : (
              <ul className="space-y-1.5">
                {data.contributions.map((c) => (
                  <li
                    key={c.type}
                    className="flex justify-between border-b border-border/50 py-1.5 text-sm last:border-0"
                  >
                    <MovementTypeBadge type={c.type} />
                    <span className="font-mono">{fmtNum(c.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-display text-sm">Movimentos recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {(data.recentMovements?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">Sem movimentos.</p>
            ) : (
              <ul className="space-y-1">
                {data.recentMovements.map((mv) => (
                  <li
                    key={mv.id}
                    className="flex items-baseline gap-2 border-b border-border/50 py-1.5 text-xs last:border-0"
                  >
                    <span className="text-muted-foreground">
                      {fmtDate(mv.created_at).split(",")[0]}
                    </span>
                    <MovementTypeBadge type={mv.type} />
                    <span className="text-muted-foreground">{mv.item_name ?? "—"}</span>
                    <span className="ml-auto font-mono">{fmtNum(mv.qty)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {isChefia && (
        <div className="mt-6">
          <MemberAdminPanel
            member={{
              id: m.id,
              display_name: m.display_name,
              nick: m.nick,
              tier: m.tier,
            }}
            myTier={myTier}
            canManage={canManage}
          />
        </div>
      )}
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: string;
}) {
  const toneMap: Record<string, string> = {
    primary: "text-primary",
    destructive: "text-destructive",
    info: "text-info",
    success: "text-success",
    warning: "text-warning",
    accent: "text-accent-foreground",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-sm border border-border/60 bg-secondary/30 p-2 ${toneMap[tone] ?? "text-foreground"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-display text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold">{fmtNum(value)}</div>
        </div>
      </CardContent>
    </Card>
  );
}

const MOVEMENT_TYPE_META: Record<string, { label: string; icon: LucideIcon; tone: string }> = {
  entrega_bairrista: { label: "Entrega", icon: Truck, tone: "text-info" },
  venda_bairrista: { label: "Venda", icon: Coins, tone: "text-warning" },
  aquisicao: { label: "Aquisição", icon: ShoppingBag, tone: "text-success" },
  saida: { label: "Saída", icon: Crosshair, tone: "text-destructive" },
  craft: { label: "Craft", icon: Package, tone: "text-primary" },
  transferencia: { label: "Transferência", icon: ArrowDownUp, tone: "text-accent-foreground" },
};

function MovementTypeBadge({ type }: { type: string }) {
  const meta = MOVEMENT_TYPE_META[type] ?? { label: type, icon: Package, tone: "text-muted-foreground" };
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${meta.tone}`}>
      <Icon className="h-3 w-3" />
      <span className="text-foreground">{meta.label}</span>
    </span>
  );
}
