import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";
import type { CurrentMember, CatalogItem } from "./pricing.shared";

export const getCurrentMember = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CurrentMember | null> => {
    return resolveCurrentMember(context.supabase, context.userId);
  });

export const getCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<CatalogItem[]> => {
    await pgQuery(`ALTER TABLE public.items ADD COLUMN IF NOT EXISTS xp_points integer DEFAULT 1`);
    return pgQuery<CatalogItem>(
      `select id, name, category, subcategory, side,
              purchase_price::float as purchase_price,
              morador_purchase_price::float as morador_purchase_price,
              min_sale_price::float as min_sale_price,
              coalesce(xp_points, 1) as xp_points
       from items
       where active = true and deleted_at is null
         and (
           side in ('compra','venda')
           or category in ('corpos','prints','armas_red','armas_orange')
           or subcategory in ('carregadores','municoes','armas_red','armas_orange')
         )
       order by side, subcategory, purchase_price desc`,
    );
  });
