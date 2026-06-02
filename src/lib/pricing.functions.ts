import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCurrentMember } from "./pricing.server";
import { pgQuery } from "./pg.server";
import type { CurrentMember, CatalogItem } from "./pricing.shared";
import { resolveItemPrices } from "./pricing.resolver";
import { getSurchargesForItems } from "./tier-pricing.functions";

export const getCurrentMember = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CurrentMember | null> => {
    return resolveCurrentMember(context.supabase, context.userId);
  });

type DbCatalogRow = {
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
};

async function getDbCatalogRows(): Promise<DbCatalogRow[]> {
  return pgQuery<DbCatalogRow>(
    `select id, name, category, subcategory, side,
            purchase_price::float as purchase_price,
            min_sale_price::float as min_sale_price,
            morador_purchase_price::float as morador_purchase_price,
            estimated_value::float as estimated_value,
            xp_points
     from items
     where coalesce(active, true) = true
       and deleted_at is null
     order by category, name`,
  );
}

function toCatalogItem(db: DbCatalogRow, side: "venda" | "compra" | "ambos", prices: ReturnType<typeof resolveItemPrices>): CatalogItem {
  return {
    id: db.id,
    name: db.name,
    category: db.category ?? "outros",
    subcategory: db.subcategory ?? null,
    side,
    purchase_price: prices.purchase_price,
    morador_purchase_price: prices.morador_purchase_price,
    min_sale_price: prices.min_sale_price,
    xp_points: db.xp_points ?? 0,
    tier_price: prices.tier_price,
    tier_price_with_material: prices.tier_price_with_material,
    tier_price_without_material: prices.tier_price_without_material,
  };
}

export const getCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CatalogItem[]> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    const dbItems = await getDbCatalogRows();
    const surchargeMap = await getSurchargesForItems(dbItems.map((d) => d.id));

    return dbItems
      .map((db) => {
        const side = (db.side ?? "venda") as "venda" | "compra" | "ambos";
        if (side !== "venda" && side !== "ambos") return null;
        const prices = resolveItemPrices(db, null, me?.tier ?? null, surchargeMap.get(db.id) ?? null);
        return toCatalogItem(db, side, prices);
      })
      .filter((item): item is CatalogItem => Boolean(item))
      .sort((a, b) => (b.tier_price_without_material ?? b.purchase_price ?? b.tier_price_with_material ?? b.min_sale_price ?? 0) - (a.tier_price_without_material ?? a.purchase_price ?? a.tier_price_with_material ?? a.min_sale_price ?? 0));
  });

export const getBuyCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<CatalogItem[]> => {
    const dbItems = await getDbCatalogRows();

    return dbItems
      .map((db) => {
        const side = (db.side ?? "compra") as "venda" | "compra" | "ambos";
        if (side !== "compra" && side !== "ambos") return null;
        const prices = resolveItemPrices(db, null);
        return toCatalogItem(db, side, prices);
      })
      .filter((item): item is CatalogItem => Boolean(item))
      .sort((a, b) => (b.morador_purchase_price ?? b.purchase_price ?? 0) - (a.morador_purchase_price ?? a.purchase_price ?? 0));
  });
