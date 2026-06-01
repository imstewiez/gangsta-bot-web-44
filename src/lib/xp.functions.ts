import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgOne } from "./pg.server";
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
};

export const getMemberXP = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { member_id: number }) => {
    const id = Number(d?.member_id);
    if (!Number.isFinite(id) || id <= 0) throw new Error("ID inválido");
    return { member_id: id };
  })
  .handler(async ({ data }): Promise<MemberXP> => {
    const pointsCase = buildItemPointsCase();
    const row = await pgOne<{ total_points: string }>(
      `SELECT COALESCE(SUM(abs(im.quantity) * ${pointsCase}), 0)::text as total_points
       FROM inventory_movements im
       JOIN items i ON i.id = im.item_id
       WHERE im.member_id = $1
         AND im.movement_type = ANY($2::text[])
         AND im.quantity > 0`,
      [
        data.member_id,
        ["entrega_bairrista", "entrega_oficial"],
      ],
    );
    const totalPoints = Number(row?.total_points ?? 0);

    const member = await pgOne<{ tier: string | null }>(
      "SELECT tier FROM members WHERE id = $1",
      [data.member_id],
    );
    const currentTier = member?.tier ?? "young_blood";

    const tierNames = getTierLabels();

    const promotions = getPromotions();
    const promotion = promotions.find((p) => p.from === currentTier);

    if (!promotion || !BAIRRISTA_TIERS.includes(currentTier as any)) {
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
