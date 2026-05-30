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

    const configItems = getAllItems();
    const configNames = Object.values(configItems).map((i) => i.name);

    // Fetch ALL active DB items (including those not in config.json)
    const dbItems = await pgQuery<{
      id: number;
      name: string;
      category: string | null;
      subcategory: string | null;
      side: string | null;
      purchase_price: number | null;
      min_sale_price: number | null;
      xp_points: number | null;
    }>(
      `select id, name, category, subcategory, side,
              purchase_price::float as purchase_price,
              min_sale_price::float as min_sale_price,
              xp_points
       from items where active = true`,
    );

    const result: CatalogItem[] = [];
    const seenDbIds = new Set<number>();

    // First pass: items from config.json with DB overrides
    for (const [id, item] of Object.entries(configItems)) {
      const db = dbItems.find((d) => d.name === item.name);
      if (!db) continue;
      seenDbIds.add(db.id);
      const effectiveSide = db.side ?? item.side ?? "venda";
      if (effectiveSide !== "venda" && effectiveSide !== "ambos") continue;

      const tierPrice = getTierPrice(id, tier) ?? db.min_sale_price ?? item.sellPrice ?? item.estimatedValue ?? 0;

      result.push({
        id: db.id,
        name: item.name,
        category: item.category ?? "outros",
        subcategory: item.subcategory,
        side: effectiveSide as "venda" | "compra" | "ambos",
        purchase_price: db.purchase_price ?? item.buyPrice ?? null,
        morador_purchase_price: null,
        min_sale_price: db.min_sale_price ?? item.sellPrice ?? null,
        xp_points: db.xp_points ?? item.xpPoints ?? 0,
        tier_price: tierPrice,
      });
    }

    // Second pass: DB items NOT in config.json
    for (const db of dbItems) {
      if (seenDbIds.has(db.id)) continue;
      const effectiveSide = db.side ?? "venda";
      if (effectiveSide !== "venda" && effectiveSide !== "ambos") continue;

      result.push({
        id: db.id,
        name: db.name,
        category: db.category ?? "outros",
        subcategory: db.subcategory,
        side: effectiveSide as "venda" | "compra" | "ambos",
        purchase_price: db.purchase_price ?? null,
        morador_purchase_price: null,
        min_sale_price: db.min_sale_price ?? null,
        xp_points: db.xp_points ?? 0,
        tier_price: db.min_sale_price ?? 0,
      });
    }

    return result.sort((a, b) => (b.min_sale_price ?? 0) - (a.min_sale_price ?? 0));
  });

export const getBuyCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CatalogItem[]> => {
    const configItems = getAllItems();

    const dbItems = await pgQuery<{
      id: number;
      name: string;
      category: string | null;
      subcategory: string | null;
      side: string | null;
      purchase_price: number | null;
      min_sale_price: number | null;
      xp_points: number | null;
    }>(
      `select id, name, category, subcategory, side,
              purchase_price::float as purchase_price,
              min_sale_price::float as min_sale_price,
              xp_points
       from items where active = true`,
    );

    const result: CatalogItem[] = [];
    const seenDbIds = new Set<number>();

    // First pass: items from config.json with DB overrides
    for (const [id, item] of Object.entries(configItems)) {
      const db = dbItems.find((d) => d.name === item.name);
      if (!db) continue;
      seenDbIds.add(db.id);
      const effectiveSide = db.side ?? item.side ?? "compra";
      if (effectiveSide !== "compra" && effectiveSide !== "ambos") continue;

      result.push({
        id: db.id,
        name: item.name,
        category: item.category ?? "outros",
        subcategory: item.subcategory,
        side: effectiveSide as "venda" | "compra" | "ambos",
        purchase_price: db.purchase_price ?? item.buyPrice ?? null,
        morador_purchase_price: null,
        min_sale_price: db.min_sale_price ?? item.sellPrice ?? null,
        xp_points: db.xp_points ?? item.xpPoints ?? 0,
        tier_price: null,
      });
    }

    // Second pass: DB items NOT in config.json
    for (const db of dbItems) {
      if (seenDbIds.has(db.id)) continue;
      const effectiveSide = db.side ?? "compra";
      if (effectiveSide !== "compra" && effectiveSide !== "ambos") continue;

      result.push({
        id: db.id,
        name: db.name,
        category: db.category ?? "outros",
        subcategory: db.subcategory,
        side: effectiveSide as "venda" | "compra" | "ambos",
        purchase_price: db.purchase_price ?? null,
        morador_purchase_price: null,
        min_sale_price: db.min_sale_price ?? null,
        xp_points: db.xp_points ?? 0,
        tier_price: null,
      });
    }

    return result.sort((a, b) => (b.purchase_price ?? 0) - (a.purchase_price ?? 0));
  });
