import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgOne } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";

// ── Pontos por item (espelho do real-gangsta-bot) ───────────────────────────
const ITEM_POINTS = new Map<string, number>([
  // 4 pontos
  ["molde de arma", 4],
  ["carroçaria", 4],
  // 3 pontos
  ["plástico velho", 3],
  ["plastico velho", 3],
  ["plástico reciclado", 3],
  ["plastico reciclado", 3],
  ["lixo eletrónico", 3],
  ["lixo eletronico", 3],
  ["barra de cobre", 3],
  ["pepita de cobre", 3],
  ["pólvora", 3],
  ["polvora", 3],
  ["peças", 3],
  ["pecas", 3],
  // 2 pontos
  ["sucata", 2],
  ["sucata enferrujada", 2],
  ["barra de ferro", 2],
  ["telemóvel estragado", 2],
  ["telemovel estragado", 2],
  ["rádio estragado", 2],
  ["radio estragado", 2],
  ["carvão", 2],
  ["carvao", 2],
  ["minério de carvão", 2],
  ["minero de carvao", 2],
  ["borracha", 2],
]);

const ZERO_POINT_CATEGORIES = new Set(["quimicos_droga", "dinheiro"]);

function pointsForItem(name: string, category: string | null): number {
  if (category && ZERO_POINT_CATEGORIES.has(category.toLowerCase())) return 0;
  return ITEM_POINTS.get(name.toLowerCase().trim()) ?? 1;
}

function buildItemPointsCase(): string {
  const cases: string[] = [];
  for (const [name, pts] of ITEM_POINTS) {
    cases.push(`WHEN LOWER(i.name) = '${name.replace(/'/g, "''")}' THEN ${pts}`);
  }
  const zeroCats = [...ZERO_POINT_CATEGORIES].map((c) => `'${c}'`).join(",");
  return `
    CASE
      WHEN i.category IN (${zeroCats}) THEN 0
      ${cases.join("\n      ")}
      ELSE 1
    END
  `;
}

// ── Thresholds de promoção ─────────────────────────────────────────────────
const PROMOTIONS = [
  { from: "young_blood", to: "o_gunao", threshold: 50000 },
  { from: "o_gunao", to: "gangster_fodido", threshold: 100000 },
] as const;

const BAIRRISTA_TIERS = ["young_blood", "o_gunao", "gangster_fodido"] as const;

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
  .inputValidator((d: { member_id: number }) => d)
  .handler(async ({ data }): Promise<MemberXP> => {
    const pointsCase = buildItemPointsCase();
    const row = await pgOne<{ total_points: string }>(
      `SELECT COALESCE(SUM(im.quantity * ${pointsCase}), 0)::text as total_points
       FROM inventory_movements im
       JOIN items i ON i.id = im.item_id
       WHERE im.member_id = $1
         AND im.movement_type = ANY($2::text[])`,
      [
        data.member_id,
        ["entrega_bairrista", "entrega_oficial", "venda_bairrista"],
      ],
    );
    const totalPoints = Number(row?.total_points ?? 0);

    const member = await pgOne<{ tier: string | null }>(
      "SELECT tier FROM members WHERE id = $1",
      [data.member_id],
    );
    const currentTier = member?.tier ?? "young_blood";

    const tierNames: Record<string, string> = {
      young_blood: "Young Blood",
      o_gunao: "O Gunão",
      gangster_fodido: "Gangster Fodido",
      patrao_di_zona: "Patrão di Zona",
      real_gangster: "Real Gangster",
      og: "OG",
      kingpin: "Kingpin",
      manda_chuva: "Manda-Chuva",
    };

    const promotion = PROMOTIONS.find((p) => p.from === currentTier);

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
