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
    return pgQuery<CatalogItem>(
      `select id, name, category, subcategory, side,
              purchase_price::float as purchase_price,
              morador_purchase_price::float as morador_purchase_price,
              min_sale_price::float as min_sale_price
       from items
       where side in ('compra','venda') and active = true and deleted_at is null
       order by side, subcategory,
                greatest(coalesce(min_sale_price,0), coalesce(purchase_price,0), coalesce(morador_purchase_price,0)) desc,
                name`
    );
  });
