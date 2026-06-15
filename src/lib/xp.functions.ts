import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgOne, pgQuery } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import { getPromotions, getTierOrder, getTierLabels } from "./config.loader";

// XP vem exclusivamente da Gestão de Materiais: items.xp_points.
// Sem fallback legacy/config: item sem xp_points explícito vale 0 pontos.
const ZERO_POINT_CATEGORIES = new Set(["quimicos_droga", "dinheiro"]);

function buildItemPointsCase(): string {
  const zeroCats = [...ZERO_POINT_CATEGORIES].map((c) => `'${c}'`).join(",");
  return `
    CASE
      WHEN lower(coalesce(i.category,'')) IN (${zeroCats}) THEN 0
      ELSE coalesce(i.xp_points, 0)
    END
  `;
}

// ── Thresholds de promoção ─────────────────────────────────────────────────
const BAIRRISTA_TIERS = getTierOrder().slice(0, 3);
const AUTO_PROMOTE_TIERS = new Set(BAIRRISTA_TIERS);

export type MemberXP = {
  totalPoints: number;
  currentTier: string;
  currentTierName: string;
  nextTier: string | null;
  nextTierName: string | null;
  threshold: number | null;
  remaining: number;
  progress: number;
  maxedOut: boolean;
  promoted?: boolean;
  previousTier?: string | null;
};

async function calculateTotalPoints(memberId: number): Promise<number> {
  const pointsCase = buildItemPointsCase();
  const row = await pgOne<{ total_points: string }>(
    `SELECT COALESCE(SUM(abs(im.quantity) * ${pointsCase}), 0)::text as total_points
     FROM inventory_movements im
     JOIN items i ON i.id = im.item_id
     WHERE im.member_id = $1
       AND im.movement_type = ANY($2::text[])
       AND im.quantity > 0`,
    [memberId, ["entrega_bairrista", "entrega_oficial"]],
  );
  return Number(row?.total_points ?? 0);
}

function resolveTierFromPoints(currentTier: string, totalPoints: number): string {
  let tier = currentTier;
  const promotions = getPromotions();

  for (let guard = 0; guard < 10; guard += 1) {
    if (!AUTO_PROMOTE_TIERS.has(tier)) break;
    const promo = promotions.find((p) => p.from === tier);
    if (!promo || !AUTO_PROMOTE_TIERS.has(promo.to)) break;
    if (totalPoints < promo.threshold) break;
    tier = promo.to;
  }

  return tier;
}

export async function applyMemberTierFromXp(memberId: number): Promise<{ totalPoints: number; previousTier: string; currentTier: string; promoted: boolean }> {
  const totalPoints = await calculateTotalPoints(memberId);
  const member = await pgOne<{ tier: string | null }>("SELECT tier FROM members WHERE id = $1", [memberId]);
  const previousTier = member?.tier ?? "young_blood";
  const currentTier = resolveTierFromPoints(previousTier, totalPoints);

  if (currentTier !== previousTier) {
    await pgQuery(
      `UPDATE members
       SET tier = $2,
           role = CASE WHEN coalesce(role, '') IN ('', 'bairrista', 'young_blood', 'o_gunao', 'gangster_fodido') THEN 'bairrista' ELSE role END,
           updated_at = now()
       WHERE id = $1`,
      [memberId, currentTier],
    );
  }

  return { totalPoints, previousTier, currentTier, promoted: currentTier !== previousTier };
}

export const getMemberXP = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { member_id: number }) => {
    const id = Number(d?.member_id);
    if (!Number.isFinite(id) || id <= 0) throw new Error("ID inválido");
    return { member_id: id };
  })
  .handler(async ({ data }): Promise<MemberXP> => {
    const sync = await applyMemberTierFromXp(data.member_id);
    const totalPoints = sync.totalPoints;
    const currentTier = sync.currentTier;
    const tierNames = getTierLabels();
    const promotions = getPromotions();
    const promotion = promotions.find((p) => p.from === currentTier);

    if (!promotion || !BAIRRISTA_TIERS.includes(currentTier as any) || !AUTO_PROMOTE_TIERS.has(promotion.to)) {
      return {
        totalPoints,
        currentTier,
        currentTierName: tierNames[currentTier] ?? currentTier,
        nextTier: null,
        nextTierName: null,
        threshold: null,
        remaining: 0,
        progress: 100,
        maxedOut: true,
        promoted: sync.promoted,
        previousTier: sync.previousTier,
      };
    }

    const threshold = promotion.threshold;
    const remaining = Math.max(0, threshold - totalPoints);
    const progress = Math.min(100, (totalPoints / threshold) * 100);

    return {
      totalPoints,
      currentTier,
      currentTierName: tierNames[currentTier] ?? currentTier,
      nextTier: promotion.to,
      nextTierName: tierNames[promotion.to] ?? promotion.to,
      threshold,
      remaining,
      progress: Math.round(progress * 10) / 10,
      maxedOut: false,
      promoted: sync.promoted,
      previousTier: sync.previousTier,
    };
  });

export const getCurrentMemberXP = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MemberXP> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me) throw new Error("Não tens conta de membro associada.");
    const xpFn = getMemberXP;
    return xpFn({ data: { member_id: me.id } });
  });
