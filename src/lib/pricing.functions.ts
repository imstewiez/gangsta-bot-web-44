import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCurrentMember } from "./pricing.server";
import { pgQuery } from "./pg.server";
import type { CurrentMember, CatalogItem } from "./pricing.shared";
import {
  getSaleItems,
  getTierPrice,
  getCategoryLabel,
  getNumericId,
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
    const itemNames = Object.values(items).map((i) => i.name);

    // Mapear nomes para IDs reais da DB para compatibilidade com encomendas/stock
    const dbItems = await pgQuery<{ id: number; name: string }>(
      `select id, name from items where name = any($1::text[]) and active = true`,
      [itemNames],
    );
    const dbIdByName = new Map(dbItems.map((i) => [i.name, i.id]));

    return Object.entries(items).map(([id, item]) => {
      const tierPrice = getTierPrice(id, tier) ?? item.sellPrice ?? item.estimatedValue ?? 0;
      const dbId = dbIdByName.get(item.name) ?? getNumericId(id);

      return {
        id: dbId,
        name: item.name,
        category: item.category ?? "outros",
        subcategory: item.subcategory,
        side: item.side,
        purchase_price: item.buyPrice,
        morador_purchase_price: null,
        min_sale_price: item.sellPrice,
        xp_points: item.xpPoints,
        tier_price: tierPrice,
      };
    }).sort((a, b) => (b.min_sale_price ?? 0) - (a.min_sale_price ?? 0));
  });
