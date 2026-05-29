import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCurrentMember } from "./pricing.server";
import type { CurrentMember, CatalogItem } from "./pricing.shared";
import {
  getSaleItems,
  getTierPrice,
  getCategoryLabel,
} from "./config.loader";

export const getCurrentMember = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CurrentMember | null> => {
    return resolveCurrentMember(context.supabase, context.userId);
  });

export const getCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CatalogItem[]> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    const tier = me?.tier ?? null;

    const items = getSaleItems();

    return Object.entries(items).map(([id, item]) => {
      const tierPrice = getTierPrice(id, tier) ?? item.sellPrice ?? item.estimatedValue ?? 0;

      return {
        id: id as unknown as number, // compatibilidade: o frontend espera number, mas agora usamos string IDs
        name: item.name,
        category: item.category ?? "outros",
        subcategory: item.subcategory,
        side: item.side,
        purchase_price: item.buyPrice,
        morador_purchase_price: null, // deprecated, removido do config.json
        min_sale_price: item.sellPrice,
        xp_points: item.xpPoints,
        tier_price: tierPrice,
      };
    }).sort((a, b) => (b.min_sale_price ?? 0) - (a.min_sale_price ?? 0));
  });
