import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCurrentMember } from "./pricing.server";
import { pgQuery } from "./pg.server";
import type { CurrentMember, CatalogItem } from "./pricing.shared";
import {
  getAllItems,
  getCategoryLabel,
  getNumericId,
} from "./config.loader";
import { resolveItemPrices } from "./pricing.resolver";
import { getSurchargesForItems } from "./tier-pricing.functions";

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
      morador_purchase_price: number | null;
      xp_points: number | null;
    }>(
      `select id, name, category, subcategory, side,
              purchase_price::float as purchase_price,
              min_sale_price::float as min_sale_price,
              morador_purchase_price::float as morador_purchase_price,
              xp_points
       from items where active = true`,
    );

    // Buscar surcharges em lote para todos os items
    const allDbIds = dbItems.map((d) => d.id);
    const surchargeMap = await getSurchargesForItems(allDbIds);

    const result: CatalogItem[] = [];
    const seenDbIds = new Set<number>();

    // Helper: use DB price only if it's a positive finite number, else fallback to config
    const priceOr = (dbVal: number | null, configVal: number | null): number | null => {
      if (dbVal != null && Number.isFinite(dbVal) && dbVal > 0) return dbVal;
      if (configVal != null && Number.isFinite(configVal) && configVal > 0) return configVal;
      return null;
    };

    // First pass: items from config.json with DB overrides
    for (const [id, item] of Object.entries(configItems)) {
      const db = dbItems.find((d) => d.name === item.name);
      if (db) seenDbIds.add(db.id);
      const effectiveSide = db?.side ?? item.side ?? "venda";
      if (effectiveSide !== "venda" && effectiveSide !== "ambos") continue;

      const prices = resolveItemPrices(
        db ?? null,
        item,
        tier,
        db ? (surchargeMap.get(db.id) ?? null) : null,
      );

      result.push({
        id: db?.id ?? getNumericId(id),
        name: item.name,
        category: item.category ?? "outros",
        subcategory: item.subcategory,
        side: effectiveSide as "venda" | "compra" | "ambos",
        purchase_price: prices.purchase_price,
        morador_purchase_price: prices.morador_purchase_price,
        min_sale_price: prices.min_sale_price,
        xp_points: db?.xp_points ?? item.xpPoints ?? 0,
        tier_price: prices.tier_price,
      });
    }

    // Second pass: DB items NOT in config.json
    for (const db of dbItems) {
      if (seenDbIds.has(db.id)) continue;
      const effectiveSide = db.side ?? "venda";
      if (effectiveSide !== "venda" && effectiveSide !== "ambos") continue;

      const prices = resolveItemPrices(
        db,
        null,
        tier,
        surchargeMap.get(db.id) ?? null,
      );

      result.push({
        id: db.id,
        name: db.name,
        category: db.category ?? "outros",
        subcategory: db.subcategory,
        side: effectiveSide as "venda" | "compra" | "ambos",
        purchase_price: prices.purchase_price,
        morador_purchase_price: prices.morador_purchase_price,
        min_sale_price: prices.min_sale_price,
        xp_points: db.xp_points ?? 0,
        tier_price: prices.tier_price,
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

    // Helper: use DB price only if it's a positive finite number, else fallback to config
    const priceOr = (dbVal: number | null, configVal: number | null): number | null => {
      if (dbVal != null && Number.isFinite(dbVal) && dbVal > 0) return dbVal;
      if (configVal != null && Number.isFinite(configVal) && configVal > 0) return configVal;
      return null;
    };

    // First pass: items from config.json with DB overrides
    for (const [id, item] of Object.entries(configItems)) {
      const db = dbItems.find((d) => d.name === item.name);
      if (db) seenDbIds.add(db.id);
      const effectiveSide = db?.side ?? item.side ?? "compra";
      if (effectiveSide !== "compra" && effectiveSide !== "ambos") continue;

      result.push({
        id: db?.id ?? getNumericId(id),
        name: item.name,
        category: item.category ?? "outros",
        subcategory: item.subcategory,
        side: effectiveSide as "venda" | "compra" | "ambos",
        purchase_price: priceOr(db?.purchase_price ?? null, item.buyPrice),
        morador_purchase_price: null,
        min_sale_price: priceOr(db?.min_sale_price ?? null, item.sellPrice),
        xp_points: db?.xp_points ?? item.xpPoints ?? 0,
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
        purchase_price: priceOr(db.purchase_price, null),
        morador_purchase_price: null,
        min_sale_price: priceOr(db.min_sale_price, null),
        xp_points: db.xp_points ?? 0,
        tier_price: null,
      });
    }

    return result.sort((a, b) => (b.purchase_price ?? 0) - (a.purchase_price ?? 0));
  });
