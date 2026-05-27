import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TierIcon } from "@/components/domain/TierIcon";
import { fmtNum, TIER_LABELS } from "@/lib/domain";
import {
  Crosshair, Skull, Swords, Package, ShoppingCart, ClipboardList,
  Trophy, Zap, ChevronRight, Lock, Home, Gift, Users,
} from "lucide-react";
import type { MemberXP } from "@/lib/xp.functions";
import type { CurrentMember } from "@/lib/pricing.shared";

const TIER_BENEFITS: Record<string, string[]> = {
  young_blood: ["Acesso ao arsenal básico", "Preços de bairrista N1"],
  o_gunao: ["Desconto nas armas (-10k€)", "Acesso à casa dos bairristas", "Considerado para Mini Gang"],
  gangster_fodido: ["Desconto máximo nas armas (-20k€)", "Acesso total à casa dos bairristas", "Membro da Mini Gang", "Giveaways extra", "Respeito de oficial"],
  patrao_di_zona: ["Gestão de zona", "Acesso a canais de comando"],
  real_gangster: ["Status de oficial eminente", "Acesso a ops avançadas"],
  og: ["Mentoria de bairristas", "Veto em decisões estratégicas"],
  kingpin: ["Acesso ao painel Chefia", "Gestão de encomendas e stock"],
  manda_chuva: ["Controlo total da firma", "Superadmin da web app"],
};

const NEXT_TIER_MAP: Record<string, string | null> = {
  young_blood: "o_gunao",
  o_gunao: "gangster_fodido",
  gangster_fodido: null,
  patrao_di_zona: null,
  real_gangster: "og",
  og: null,
  kingpin: "manda_chuva",
  manda_chuva: null,
};

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
  const nextTier = NEXT_TIER_MAP[tier];
  const nextBenefits = nextTier ? TIER_BENEFITS[nextTier] ?? [] : [];

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card interactive-card overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-center gap-4 p-5 pb-4">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-primary/15 ring-2 ring-primary/30 shrink-0">
            <TierIcon tier={tier} size="lg" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-display text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
              {member.role_label ?? "Bairrista"}
            </div>
            <div className="text-xl font-bold truncate">
              {member.display_name ?? "Sem nome"}
            </div>
            <div className="text-xs text-primary font-medium">
              {tierLabel}
            </div>
          </div>
        </div>

        {/* Stats grid */}
        {stats && (
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-px bg-border/40 mx-5 rounded-sm overflow-hidden">
            <StatBox icon={<Crosshair className="h-3.5 w-3.5" />} label="Kills" value={stats.kills} />
            <StatBox icon={<Skull className="h-3.5 w-3.5" />} label="Mortes" value={stats.deaths} />
            <StatBox icon={<Zap className="h-3.5 w-3.5" />} label="K/D" value={stats.kd} />
            <StatBox icon={<Swords className="h-3.5 w-3.5" />} label="Saídas" value={stats.saidas} />
            <StatBox icon={<Trophy className="h-3.5 w-3.5" />} label="Win%" value={`${stats.winRate}%`} />
            <StatBox icon={<Package className="h-3.5 w-3.5" />} label="Entregas" value={stats.deliveries} />
            <StatBox icon={<ShoppingCart className="h-3.5 w-3.5" />} label="Vendas" value={stats.sales} />
            <StatBox icon={<ClipboardList className="h-3.5 w-3.5" />} label="Encom." value={stats.orders} />
          </div>
        )}

        {/* XP Progress */}
        {xp && !xp.maxedOut && (
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-medium">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <span>Progresso para {xp.nextTierName}</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {fmtNum(xp.totalPoints)} / {fmtNum(xp.threshold ?? 0)} XP
              </div>
            </div>
            <Progress value={xp.progress} className="h-2" />
            <div className="mt-1.5 text-[11px] text-muted-foreground text-right">
              Faltam {fmtNum(xp.remaining)} XP ({xp.progress.toFixed(1)}%)
            </div>
          </div>
        )}

        {xp?.maxedOut && (
          <div className="px-5 py-4 text-xs text-muted-foreground flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5 text-amber-400" />
            Tier máximo atingido neste ramo!
          </div>
        )}

        {/* Next tier benefits */}
        {nextTier && nextBenefits.length > 0 && (
          <div className="mx-5 mb-5 rounded-sm border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 uppercase tracking-wider mb-2">
              <ChevronRight className="h-3 w-3" />
              Próximo nível: {TIER_LABELS[nextTier] ?? nextTier}
            </div>
            <ul className="space-y-1.5">
              {nextBenefits.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-amber-200/80">
                  <span className="mt-0.5 shrink-0">
                    {b.includes("Desconto") ? <Gift className="h-3 w-3" /> :
                     b.includes("casa") ? <Home className="h-3 w-3" /> :
                     b.includes("Mini Gang") || b.includes("oficial") ? <Users className="h-3 w-3" /> :
                     b.includes("Giveaway") ? <Gift className="h-3 w-3" /> :
                     <Lock className="h-3 w-3" />}
                  </span>
                  {b}
                </li>
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
    <div className="bg-card p-2.5 text-center">
      <div className="flex justify-center text-muted-foreground mb-0.5">{icon}</div>
      <div className="text-sm font-bold tabular-nums">{value}</div>
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}
