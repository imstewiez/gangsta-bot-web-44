import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery } from "./pg.server";

export const probeSchema = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const cats = await pgQuery<{ category: string; subcategory: string | null; n: number }>(
      `select category, subcategory, count(*)::int as n from items where deleted_at is null group by 1,2 order by 1,2`
    );
    const tables = await pgQuery<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema='public' order by 1`
    );
    const opCols = await pgQuery<{ column_name: string; data_type: string }>(
      `select column_name, data_type from information_schema.columns where table_schema='public' and table_name in ('operations','operation_participants','inventory_delivery_requests','recipes','members') order by table_name, ordinal_position`
    );
    return { cats, tables, opCols };
  });
