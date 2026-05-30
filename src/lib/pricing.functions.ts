import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCurrentMember } from "./pricing.server";
import { pgQuery } from "./pg.server";
import type { CurrentMember, CatalogItem } from "./pricing.shared";
import {
  getAllItems,
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

    const items = getAllItems();
    const itemNames = Object.values(items).map((i) => i.name);

    // Mapear nomes para IDs reais da DB + preços actualizados + side da DB
    const dbItems = await pgQuery<{
      id: number;
      name: string;
      side: string | null;
      purchase_price: number | null;
      min_sale_price: number | null;
      xp_points: number | null;
    }>(
      `select id, name, side, purchase_price::float as purchase_price, min_sale_price::float as min_sale_price, xp_points
       from items where name = any($1::text[]) and active = true`,
      [itemNames],
    );
    const dbByName = new Map(dbItems.map((i) => [i.name, i]));

    return Object.entries(items)
      .filter(([id, item]) => {
        const db = dbByName.get(item.name);
        const effectiveSide = db?.side ?? item.side ?? "venda";
        return effectiveSide === "venda" || effectiveSide === "ambos";
      })
      .map(([id, item]) => {
        const db = dbByName.get(item.name);
        const tierPrice = getTierPrice(id, tier) ?? db?.min_sale_price ?? item.sellPrice ?? item.estimatedValue ?? 0;
        const dbId = db?.id ?? getNumericId(id);

        return {
          id: dbId,
          name: item.name,
          category: item.category ?? "outros",
          subcategory: item.subcategory,
          side: db?.side ?? item.side ?? "venda",
          purchase_price: db?.purchase_price ?? item.buyPrice ?? null,
          morador_purchase_price: null,
          min_sale_price: db?.min_sale_price ?? item.sellPrice ?? null,
          xp_points: db?.xp_points ?? item.xpPoints ?? 0,
          tier_price: tierPrice,
        };
      }).sort((a, b) => (b.min_sale_price ?? 0) - (a.min_sale_price ?? 0));
  });

export const getBuyCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CatalogItem[]> => {
    const items = getAllItems();
    const itemNames = Object.values(items).map((i) => i.name);

    const dbItems = await pgQuery<{
      id: number;
      name: string;
      side: string | null;
      purchase_price: number | null;
      min_sale_price: number | null;
      xp_points: number | null;
    }>(
      `select id, name, side, purchase_price::float as purchase_price, min_sale_price::float as min_sale_price, xp_points
       from items where name = any($1::text[]) and active = true`,
      [itemNames],
    );
    const dbByName = new Map(dbItems.map((i) => [i.name, i]));

    return Object.entries(items)
      .filter(([id, item]) => {
        const db = dbByName.get(item.name);
        const effectiveSide = db?.side ?? item.side ?? "compra";
        return effectiveSide === "compra" || effectiveSide === "ambos";
      })
      .map(([id, item]) => {
        const db = dbByName.get(item.name);
        const dbId = db?.id ?? getNumericId(id);

        return {
          id: dbId,
          name: item.name,
          category: item.category ?? "outros",
          subcategory: item.subcategory,
          side: db?.side ?? item.side ?? "compra",
          purchase_price: db?.purchase_price ?? item.buyPrice ?? null,
          morador_purchase_price: null,
          min_sale_price: db?.min_sale_price ?? item.sellPrice ?? null,
          xp_points: db?.xp_points ?? item.xpPoints ?? 0,
          tier_price: null,
        };
      }).sort((a, b) => (b.purchase_price ?? 0) - (a.purchase_price ?? 0));
  });
