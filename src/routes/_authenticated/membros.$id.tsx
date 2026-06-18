import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthedServerFn, setViewAsMemberId } from "@/lib/authed-server-fn";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { getMember } from "@/lib/members.functions";
import { getCurrentMember } from "@/lib/pricing.functions";
import { getMemberXP } from "@/lib/xp.functions";
import { PageHeader } from "@/components/layout/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { fmtNum, fmtDate, POSITION_LABELS, TIER_ORDER } from "@/lib/domain";
import { MemberIdentity } from "@/components/domain/RoleBadge";
import { MemberAdminPanel } from "@/components/domain/MemberAdminPanel";
import { Skull, Crosshair, Truck, Coins, ShoppingBag, Package, Sword, ArrowDownUp, Zap, TrendingUp, Loader2, Eye, File } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Reveal } from "@/components/layout/Reveal";
import { EMPTY_STATE } from "@/lib/messages";

export const Route = createFileRoute("/_authenticated/membros/$id")({
  head: () => ({ meta: [{ title: "Membro | Ballas Gang" }] }),
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

  const { data, isLoading } = useQuery({ queryKey: ["member", id], queryFn: () => fn({ data: { id: Number(id) } }) });
  const me = useQuery({ queryKey: ["me"], queryFn: () => meFn(), staleTime: 60_000 });
  const xp = useQuery({ queryKey: ["member-xp", id], queryFn: () => xpFn({ data: { member_id: Number(id) } }), enabled: !isLoading && !!data?.member });

  if (isLoading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!data?.member) return <div className="flex h-96 flex-col items-center justify-center gap-4"><File className="mx-auto h-10 w-10 text-muted-foreground/30" /><p className="text-sm font-medium text-foreground">{EMPTY_STATE.memberProfileRecords.title}</p><p className="text-xs text-muted-foreground">{EMPTY_STATE.memberProfileRecords.description}</p><Link to="/membros" className="text-primary interactive-link cursor-pointer text-sm">Voltar</Link></div>;

  const m = data.member;
  const isChefia = me.data?.is_manager ?? false;
  const myTier = me.data?.tier ?? null;
  const isSuperadmin = me.data?.is_superadmin ?? false;
  const kd = data.deaths > 0 ? (data.kills / data.deaths).toFixed(2) : String(data.kills);

  function tierRank(t: string | null) { return t ? TIER_ORDER.indexOf(t) : -1; }
  const canManage = isChefia && tierRank(myTier) > tierRank(m.tier);

  function viewAsThisMember() {
    setViewAsMemberId(String(m.id));
    toast.success(`A ver a app como ${m.display_name ?? "este membro"}`);
    window.location.href = "/dashboard";
  }

  return (
    <>
      <PageHeader
        eyebrow={POSITION_LABELS[m.tier ?? "bairrista"]}
        title={m.display_name ?? "—"}
        action={<div className="flex flex-wrap items-center justify-end gap-2"><MemberIdentity tier={m.tier} size="md" />{isSuperadmin && <Button onClick={viewAsThisMember} variant="outline" size="sm" className="border-primary/35 bg-primary/10 text-primary hover:bg-primary/15"><Eye className="mr-2 h-4 w-4" />Ver como</Button>}</div>}
      />

      <Reveal direction="up">
        {xp.data && !xp.data.maxedOut && (
          <Card className="mt-4 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="p-4">
              <div className="mb-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/15 p-2"><Zap className="h-4 w-4 text-primary" /></div>
                  <div><div className="text-display text-[10px] text-muted-foreground">Progresso</div><div className="text-sm font-semibold">{xp.data.currentTierName} → {xp.data.nextTierName}</div></div>
                </div>
                <div className="text-right"><div className="text-2xl font-bold tabular-nums">{fmtNum(xp.data.totalPoints)}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">XP</div></div>
              </div>
              <Progress value={xp.data.progress} className="h-2.5" />
              <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground"><span>0</span><span>{xp.data.progress.toFixed(1)}% · faltam {fmtNum(xp.data.remaining)} XP</span><span>{fmtNum(xp.data.threshold ?? 0)}</span></div>
            </CardContent>
          </Card>
        )}
        {xp.data && xp.data.maxedOut && (
          <Card className="mt-4 border-amber-400/30 bg-gradient-to-br from-amber-400/5 to-transparent">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="rounded-lg bg-amber-400/15 p-2"><TrendingUp className="h-4 w-4 text-amber-400" /></div>
              <div><div className="text-display text-[10px] text-muted-foreground">Progresso</div><div className="text-sm font-semibold">{xp.data.currentTierName} — máximo atingido</div></div>
              <div className="ml-auto text-right"><div className="text-2xl font-bold tabular-nums">{fmtNum(xp.data.totalPoints)}</div><div className="text-[10px] uppercase tracking-wider text-muted-foreground">XP</div></div>
            </CardContent>
          </Card>
        )}
      </Reveal>

      <Reveal direction="up" delay={100}>
        <div className="mt-4 grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Sword} label="Abates" value={data.kills} tone="primary" />
          <StatCard icon={Skull} label="Mortes" value={data.deaths} tone="destructive" />
          <StatCard icon={Crosshair} label="KDA" value={kd} tone="info" />
          <StatCard icon={Truck} label="Entregas" value={data.deliveries} tone="success" />
          <StatCard icon={Coins} label="Vendas" value={data.vendas} tone="warning" />
          <StatCard icon={ShoppingBag} label="Encomendas" value={data.orders} tone="accent" />
          <InfoCard label="Entrou" value={fmtDate(m.joined_at)} />
          <InfoCard label="Discord ID" value={m.discord_id ?? "—"} mono />
        </div>
      </Reveal>

      <Reveal direction="up" delay={150}>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card><CardHeader><CardTitle>Contribuições</CardTitle></CardHeader><CardContent>{(data.contributions?.length ?? 0) === 0 ? <EmptyState icon={File} title={EMPTY_STATE.memberProfileRecords.title} description={EMPTY_STATE.memberProfileRecords.description} /> : <ul className="space-y-1.5">{data.contributions.map((c) => <li key={c.type} className="interactive-row flex justify-between border-b border-border/50 py-1.5 text-sm last:border-0"><MovementTypeBadge type={c.type} /><span className="font-mono">{fmtNum(c.total)}{c.points > 0 && <XpPill points={c.points} />}</span></li>)}</ul>}</CardContent></Card>
          <Card><CardHeader><CardTitle>Movimentos recentes</CardTitle></CardHeader><CardContent>{(data.recentMovements?.length ?? 0) === 0 ? <EmptyState icon={ArrowDownUp} title={EMPTY_STATE.memberProfileMovements.title} description={EMPTY_STATE.memberProfileMovements.description} /> : <ul className="space-y-1">{data.recentMovements.map((mv) => <li key={mv.id} className="interactive-row flex items-baseline gap-2 border-b border-border/50 py-1.5 text-xs last:border-0"><span className="text-muted-foreground">{fmtDate(mv.created_at).split(",")[0]}</span><MovementTypeBadge type={mv.type} /><span className="text-muted-foreground">{mv.item_name ?? "—"}</span><span className="ml-auto font-mono">{fmtNum(mv.qty)}{mv.points > 0 && <XpPill points={mv.points} />}</span></li>)}</ul>}</CardContent></Card>
        </div>
      </Reveal>

      {isChefia && <Reveal direction="up" delay={200}><div className="mt-6"><MemberAdminPanel member={{ id: m.id, display_name: m.display_name, nick: m.nick, tier: m.tier }} stats={{ kills: data.kills, deaths: data.deaths, saidas: data.saidas, deliveries: data.deliveries, vendas: data.vendas, orders: data.orders }} myTier={myTier} canManage={canManage} /></div></Reveal>}
    </>
  );
}

function XpPill({ points }: { points: number }) {
  return <span className="ml-1 whitespace-nowrap text-[11px] font-semibold text-primary">(+{fmtNum(points)} XP)</span>;
}

function InfoCard({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return <Card><CardContent className="flex h-full min-h-[98px] flex-col justify-between p-4"><div className="text-display text-[11px] text-muted-foreground">{label}</div><div className={mono ? "break-all font-mono text-xs" : "text-sm font-semibold"}>{value}</div></CardContent></Card>;
}

function StatCard({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: number | string; tone: string }) {
  const toneMap: Record<string, string> = { primary: "text-primary", destructive: "text-destructive", info: "text-info", success: "text-success", warning: "text-warning", accent: "text-accent-foreground" };
  return <Card><CardContent className="flex h-full min-h-[98px] items-center gap-3 p-4"><div className={`rounded-lg border border-border/60 bg-secondary/30 p-2 ${toneMap[tone] ?? "text-foreground"}`}><Icon className="h-5 w-5" /></div><div><div className="text-display text-[11px] text-muted-foreground">{label}</div><div className="text-2xl font-bold">{typeof value === "number" ? fmtNum(value) : value}</div></div></CardContent></Card>;
}

function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return <div className="py-6 text-center"><Icon className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" /><p className="text-sm font-medium text-foreground">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></div>;
}

const MOVEMENT_TYPE_META: Record<string, { label: string; icon: LucideIcon; tone: string }> = {
  entrega_bairrista: { label: "Entrega", icon: Truck, tone: "text-info" },
  entrega_oficial: { label: "Entrega", icon: Truck, tone: "text-info" },
  venda_bairrista: { label: "Venda", icon: Coins, tone: "text-warning" },
  aquisicao: { label: "Aquisição", icon: ShoppingBag, tone: "text-success" },
  saida: { label: "Saída", icon: Crosshair, tone: "text-destructive" },
  craft: { label: "Fabricação", icon: Package, tone: "text-primary" },
  transferencia: { label: "Transferência", icon: ArrowDownUp, tone: "text-accent-foreground" },
};

function MovementTypeBadge({ type }: { type: string }) {
  const meta = MOVEMENT_TYPE_META[type] ?? { label: type, icon: Package, tone: "text-muted-foreground" };
  const Icon = meta.icon;
  return <span className={`inline-flex items-center gap-1.5 text-xs ${meta.tone}`}><Icon className="h-3 w-3" /><span className="text-foreground">{meta.label}</span></span>;
}
