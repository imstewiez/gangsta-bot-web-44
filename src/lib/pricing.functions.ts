import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import type { CurrentMember, CatalogItem } from "./pricing.shared";
import { getWeaponSalePrice, getMagazineSalePrice } from "./pricing.catalog";

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

    const rows = await pgQuery<CatalogItem>(
      `select id, name, category, subcategory, side,
              purchase_price::float as purchase_price,
              morador_purchase_price::float as morador_purchase_price,
              min_sale_price::float as min_sale_price,
              coalesce(xp_points, 1) as xp_points
       from items
       where active = true and deleted_at is null
       order by side, subcategory, purchase_price desc`,
    );

    return rows.map((item) => {
      const base = item.min_sale_price ?? 0;
      let tierPrice = base;

      // Corpos e prints mantêm sempre o preço base
      const isBodyOrPrint = /\bcorpo\b|\bprint\b/i.test(item.name);

      // Aplica acréscimo por tier a armas de fogo
      if (!isBodyOrPrint && (
        item.category === "armas_red" ||
        item.category === "armas_orange" ||
        item.subcategory === "armas_red" ||
        item.subcategory === "armas_orange" ||
        /mini smg|xm3|micro smg|tec-9|tec pistol|ap pistol|heavy|\.50|p90|pdw|bullpup|carabina|compact rifle/i.test(item.name)
      )) {
        tierPrice = getWeaponSalePrice(base, tier);
      }

      // Aplica preço por tier a carregadores
      if (item.subcategory === "carregadores" || item.category === "municoes") {
        const magTier = item.name.toLowerCase().includes("special")
          ? "special"
          : item.name.toLowerCase().includes("red")
            ? "red"
            : "orange";
        tierPrice = getMagazineSalePrice(magTier, tier);
      }

      return { ...item, tier_price: tierPrice };
    });
  });
