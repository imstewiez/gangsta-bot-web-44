import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TierIcon } from "@/components/domain/TierIcon";
import { fmtNum, TIER_LABELS } from "@/lib/domain";
import {
  Crosshair,
  Skull,
  Swords,
  Package,
  ShoppingCart,
  ClipboardList,
  Trophy,
  Zap,
  ChevronRight,
} from "lucide-react";
import type { MemberXP } from "@/lib/xp.functions";
import type { CurrentMember } from "@/lib/pricing.shared";
import { getTierBenefits, getPromotions } from "@/lib/config.loader";

export function ProfileCard({
  member,
  xp,
  stats,
}: {
  member: CurrentMember | null;
  xp: MemberXP | null;
  stats: {
    kills: number;
    deaths: number;
    saidas: number;
    deliveries: number;
    sales: number;
    orders: number;
    wins: number;
    losses: number;
    kd: string;
    winRate: string;
  } | null;
}) {
  if (!member) return null;
  const tier = member.tier ?? "young_blood";
  const tierLabel = TIER_LABELS[tier] ?? tier;
  const promotions = getPromotions();
  const nextTier = promotions.find((p) => p.from === tier)?.to ?? null;
  const benefits = getTierBenefits();
  const nextBenefits = nextTier ? benefits[nextTier] ?? [] : [];

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
      <CardContent className="p-0">
        <div className="flex flex-col items-center gap-3 p-5 text-center sm:flex-row sm:text-left">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-primary/15 ring-2 ring-primary/30">
            <TierIcon tier={tier} size="lg" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-display text-[10px] tracking-[0.22em] text-muted-foreground">{member.role_label ?? "Membro"}</div>
            <div className="truncate text-xl font-bold">{member.display_name ?? "Sem nome"}</div>
            <div className="text-xs font-medium text-primary">{tierLabel}</div>
          </div>
        </div>

        {stats && (
          <div className="mx-5 grid overflow-hidden rounded-2xl border border-border/45 bg-border/35 sm:grid-cols-4 xl:grid-cols-8">
            <StatBox icon={<Crosshair className="h-3.5 w-3.5" />} label="Abates" value={stats.kills} />
            <StatBox icon={<Skull className="h-3.5 w-3.5" />} label="Mortes" value={stats.deaths} />
            <StatBox icon={<Zap className="h-3.5 w-3.5" />} label="KDA" value={stats.kd} />
            <StatBox icon={<Swords className="h-3.5 w-3.5" />} label="Saídas" value={stats.saidas} />
            <StatBox icon={<Trophy className="h-3.5 w-3.5" />} label="Win" value={`${stats.winRate}%`} />
            <StatBox icon={<Package className="h-3.5 w-3.5" />} label="Entregas" value={stats.deliveries} />
            <StatBox icon={<ShoppingCart className="h-3.5 w-3.5" />} label="Vendas" value={stats.sales} />
            <StatBox icon={<ClipboardList className="h-3.5 w-3.5" />} label="Pedidos" value={stats.orders} />
          </div>
        )}

        {xp && !xp.maxedOut && (
          <div className="px-5 py-4">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 font-medium">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <span>{xp.nextTierName}</span>
              </div>
              <div className="text-muted-foreground">{fmtNum(xp.totalPoints)} / {fmtNum(xp.threshold ?? 0)} XP</div>
            </div>
            <Progress value={xp.progress} className="h-2" />
            <div className="mt-1.5 text-right text-[11px] text-muted-foreground">Faltam {fmtNum(xp.remaining)} XP</div>
          </div>
        )}

        {xp?.maxedOut && (
          <div className="flex items-center justify-center gap-2 px-5 py-4 text-xs text-muted-foreground">
            <Trophy className="h-3.5 w-3.5 text-amber-400" />
            Tier máximo
          </div>
        )}

        {nextTier && nextBenefits.length > 0 && (
          <div className="mx-5 mb-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-400">
              <ChevronRight className="h-3 w-3" />
              {TIER_LABELS[nextTier] ?? nextTier}
            </div>
            <ul className="space-y-1.5">
              {nextBenefits.slice(0, 4).map((b, i) => (
                <li key={i} className="text-xs text-amber-200/80">{b}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex min-h-[78px] flex-col items-center justify-center bg-card p-2.5 text-center">
      <div className="mb-1 flex justify-center text-muted-foreground">{icon}</div>
      <div className="font-display text-base font-bold tabular-nums leading-none">{value}</div>
      <div className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
