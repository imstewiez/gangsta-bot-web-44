import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuthedServerFn } from "@/lib/authed-server-fn";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { getMember } from "@/lib/members.functions";
import { getCurrentMember } from "@/lib/pricing.functions";
import { getMemberXP } from "@/lib/xp.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
  Zap,
  TrendingUp,
  Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Reveal, Stagger } from "@/components/layout/Reveal";

export const Route = createFileRoute("/_authenticated/membros/$id")({
  head: () => ({
    meta: [{ title: "Membro | Ballas Gang" }],
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  useRealtimeSync([
    "members",
    { table: "inventory_movements", queryKeys: [["member", id], ["member-xp", id]] },
    { table: "all_time_stats", queryKeys: [["member", id]] },
  ]);
  const fn = useAuthedServerFn(getMember);
  const meFn = useAuthedServerFn(getCurrentMember);
  const xpFn = useAuthedServerFn(getMemberXP);
  const { data, isLoading } = useQuery({
    queryKey: ["member", id],
    queryFn: () => fn({ data: { id: Number(id) } }),
  });
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => meFn(),
    staleTime: 60_000,
  });
  const xp = useQuery({
    queryKey: ["member-xp", id],
    queryFn: () => xpFn({ data: { member_id: Number(id) } }),
    enabled: !isLoading && !!data?.member,
  });
  if (isLoading)
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  if (!data?.member)
    return (
      <div className="p-6 space-y-4">
        <p className="text-destructive font-semibold">Membro não encontrado.</p>
        <div className="bg-muted/40 rounded-lg p-4 text-xs font-mono space-y-1">
          <p><strong>URL id:</strong> {id}</p>
          <p><strong>Number(id):</strong> {String(Number(id))}</p>
          <p><strong>data:</strong> {JSON.stringify(data, null, 2)}</p>

        </div>
        <Link to="/membros" className="text-primary interactive-link cursor-pointer">
          Voltar
        </Link>
      </div>
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

      {/* XP Progress Card */}
      <Reveal direction="up">
        {xp.data && !xp.data.maxedOut && (
          <Card className="interactive-card mt-4 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-sm bg-primary/15 p-1.5">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="text-display text-[10px] uppercase tracking-wider text-muted-foreground">
                    Progresso de bairrista
                  </div>
                  <div className="text-sm font-semibold">
                    {xp.data.currentTierName} → {xp.data.nextTierName}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums">{fmtNum(xp.data.totalPoints)}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">XP total</div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Progress value={xp.data.progress} className="h-2.5" />
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>0</span>
                <span>
                  {xp.data.progress.toFixed(1)}% — faltam {fmtNum(xp.data.remaining)} XP
                </span>
                <span>{fmtNum(xp.data.threshold ?? 0)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {xp.data && xp.data.maxedOut && (
        <Card className="interactive-card mt-4 border-amber-400/30 bg-gradient-to-br from-amber-400/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <div className="rounded-sm bg-amber-400/15 p-1.5">
                <TrendingUp className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <div className="text-display text-[10px] uppercase tracking-wider text-muted-foreground">
                  Progresso de bairrista
                </div>
                <div className="text-sm font-semibold">
                  {xp.data.currentTierName} — Máximo atingido
                </div>
              </div>
              <div className="ml-auto text-right">
                <div className="text-2xl font-bold tabular-nums">{fmtNum(xp.data.totalPoints)}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">XP total</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      </Reveal>

      {/* Stats grid */}
      <Reveal direction="up" delay={100}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mt-4">
          <StatCard icon={Sword} label="Kills" value={data.kills} tone="primary" />
          <StatCard icon={Skull} label="Mortes" value={data.deaths} tone="destructive" />
          <StatCard icon={Crosshair} label="Saídas" value={data.saidas} tone="info" />
          <StatCard icon={Truck} label="Entregas" value={data.deliveries} tone="success" />
          <StatCard icon={Coins} label="Vendas" value={data.vendas} tone="warning" />
          <StatCard icon={ShoppingBag} label="Encomendas" value={data.orders} tone="accent" />
          <Card className="interactive-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-display text-[11px] uppercase tracking-wider text-muted-foreground">Entrou</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">{fmtDate(m.joined_at)}</CardContent>
          </Card>
          <Card className="interactive-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-display text-[11px] uppercase tracking-wider text-muted-foreground">Discord ID</CardTitle>
            </CardHeader>
            <CardContent className="font-mono text-xs">{m.discord_id ?? "—"}</CardContent>
          </Card>
        </div>
      </Reveal>

      <Reveal direction="up" delay={150}>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card className="interactive-card">
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
                      className="interactive-row flex justify-between border-b border-border/50 py-1.5 text-sm last:border-0"
                    >
                      <MovementTypeBadge type={c.type} />
                      <span className="font-mono">{fmtNum(c.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card className="interactive-card">
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
                      className="interactive-row flex items-baseline gap-2 border-b border-border/50 py-1.5 text-xs last:border-0"
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
      </Reveal>

      {isChefia && (
        <Reveal direction="up" delay={200}>
          <div className="mt-6">
            <MemberAdminPanel
              member={{
                id: m.id,
                display_name: m.display_name,
                nick: m.nick,
                tier: m.tier,
              }}
              stats={{
                kills: data.kills,
                deaths: data.deaths,
                saidas: data.saidas,
                deliveries: data.deliveries,
                vendas: data.vendas,
                orders: data.orders,
              }}
              myTier={myTier}
              canManage={canManage}
            />
          </div>
        </Reveal>
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
    <Card className="interactive-card">
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
