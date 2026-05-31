import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCurrentMember } from "./pricing.server";
import { pgQuery } from "./pg.server";
import type { CurrentMember, CatalogItem } from "./pricing.shared";
import { getAllItems, getNumericId } from "./config.loader";
import { resolveItemPrices } from "./pricing.resolver";
import { getSurchargesForItems } from "./tier-pricing.functions";

export const getCurrentMember = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CurrentMember | null> => {
    return resolveCurrentMember(context.supabase, context.userId);
  });

function getConfigMaps() {
  const configItems = getAllItems();
  const byName = new Map(Object.entries(configItems).map(([id, item]) => [item.name, { id, item }]));
  return { configItems, byName };
}

export const getCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CatalogItem[]> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    const { configItems, byName } = getConfigMaps();
    const dbItems = await pgQuery<{
      id: number;
      name: string;
      category: string | null;
      subcategory: string | null;
      side: string | null;
      purchase_price: number | null;
      min_sale_price: number | null;
      morador_purchase_price: number | null;
      estimated_value: number | null;
      xp_points: number | null;
    }>(
      `select id, name, category, subcategory, side,
              purchase_price::float as purchase_price,
              min_sale_price::float as min_sale_price,
              morador_purchase_price::float as morador_purchase_price,
              estimated_value::float as estimated_value,
              xp_points
       from items
       where coalesce(active, true) = true and deleted_at is null`,
    );

    const surchargeMap = await getSurchargesForItems(dbItems.map((d) => d.id));
    const result: CatalogItem[] = [];
    const seenDbIds = new Set<number>();

    for (const [id, item] of Object.entries(configItems)) {
      const db = dbItems.find((d) => d.name === item.name);
      if (db) seenDbIds.add(db.id);
      const effectiveSide = db?.side ?? item.side ?? "venda";
      if (effectiveSide !== "venda" && effectiveSide !== "ambos") continue;
      const prices = resolveItemPrices(db ?? null, item, me?.tier ?? null, db ? (surchargeMap.get(db.id) ?? null) : null);
      result.push({
        id: db?.id ?? getNumericId(id),
        name: item.name,
        category: db?.category ?? item.category ?? "outros",
        subcategory: db?.subcategory ?? item.subcategory,
        side: effectiveSide as "venda" | "compra" | "ambos",
        purchase_price: prices.purchase_price,
        morador_purchase_price: prices.morador_purchase_price,
        min_sale_price: prices.min_sale_price,
        xp_points: db?.xp_points ?? item.xpPoints ?? 0,
        tier_price: prices.tier_price,
      });
    }

    for (const db of dbItems) {
      if (seenDbIds.has(db.id)) continue;
      const effectiveSide = db.side ?? "venda";
      if (effectiveSide !== "venda" && effectiveSide !== "ambos") continue;
      const config = byName.get(db.name)?.item ?? null;
      const prices = resolveItemPrices(db, config, me?.tier ?? null, surchargeMap.get(db.id) ?? null);
      result.push({
        id: db.id,
        name: db.name,
        category: db.category ?? config?.category ?? "outros",
        subcategory: db.subcategory ?? config?.subcategory ?? null,
        side: effectiveSide as "venda" | "compra" | "ambos",
        purchase_price: prices.purchase_price,
        morador_purchase_price: prices.morador_purchase_price,
        min_sale_price: prices.min_sale_price,
        xp_points: db.xp_points ?? config?.xpPoints ?? 0,
        tier_price: prices.tier_price,
      });
    }

    return result.sort((a, b) => (b.min_sale_price ?? 0) - (a.min_sale_price ?? 0));
  });

export const getBuyCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<CatalogItem[]> => {
    const { configItems, byName } = getConfigMaps();
    const dbItems = await pgQuery<{
      id: number;
      name: string;
      category: string | null;
      subcategory: string | null;
      side: string | null;
      purchase_price: number | null;
      min_sale_price: number | null;
      morador_purchase_price: number | null;
      estimated_value: number | null;
      xp_points: number | null;
    }>(
      `select id, name, category, subcategory, side,
              purchase_price::float as purchase_price,
              min_sale_price::float as min_sale_price,
              morador_purchase_price::float as morador_purchase_price,
              estimated_value::float as estimated_value,
              xp_points
       from items
       where coalesce(active, true) = true and deleted_at is null`,
    );

    const result: CatalogItem[] = [];
    const seenDbIds = new Set<number>();

    for (const [id, item] of Object.entries(configItems)) {
      const db = dbItems.find((d) => d.name === item.name);
      if (db) seenDbIds.add(db.id);
      const effectiveSide = db?.side ?? item.side ?? "compra";
      if (effectiveSide !== "compra" && effectiveSide !== "ambos") continue;
      const prices = resolveItemPrices(db ?? null, item);
      result.push({
        id: db?.id ?? getNumericId(id),
        name: item.name,
        category: db?.category ?? item.category ?? "outros",
        subcategory: db?.subcategory ?? item.subcategory,
        side: effectiveSide as "venda" | "compra" | "ambos",
        purchase_price: prices.purchase_price,
        morador_purchase_price: prices.morador_purchase_price,
        min_sale_price: prices.min_sale_price,
        xp_points: db?.xp_points ?? item.xpPoints ?? 0,
        tier_price: null,
      });
    }

    for (const db of dbItems) {
      if (seenDbIds.has(db.id)) continue;
      const effectiveSide = db.side ?? "compra";
      if (effectiveSide !== "compra" && effectiveSide !== "ambos") continue;
      const config = byName.get(db.name)?.item ?? null;
      const prices = resolveItemPrices(db, config);
      result.push({
        id: db.id,
        name: db.name,
        category: db.category ?? config?.category ?? "outros",
        subcategory: db.subcategory ?? config?.subcategory ?? null,
        side: effectiveSide as "venda" | "compra" | "ambos",
        purchase_price: prices.purchase_price,
        morador_purchase_price: prices.morador_purchase_price,
        min_sale_price: prices.min_sale_price,
        xp_points: db.xp_points ?? config?.xpPoints ?? 0,
        tier_price: null,
      });
    }

    return result.sort((a, b) => (b.purchase_price ?? 0) - (a.purchase_price ?? 0));
  });
