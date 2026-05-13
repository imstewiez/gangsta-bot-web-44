import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";

// Categorias que interessam ao armazém
const INV_CATEGORIES = [
  "armas",
  "armas_fogo",
  "armas_brancas",
  "municoes",
  "acessorios",
  "drogas",
  "materiais",
  "materias_primas",
  "componentes",
  "minerios",
  "corpos",
  "prints",
];

async function gateInventory(supabase: unknown, userId: string) {
  const me = await resolveCurrentMember(supabase as never, userId);
  if (!me?.can_see_inventory) throw new Error("Sem acesso ao armazém.");
  return me;
}

export type StockRow = {
  item_id: number;
  item_name: string;
  category: string | null;
  subcategory: string | null;
  qty: number;
  unit_price: number | null;
};

export const getStock = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StockRow[]> => {
    await gateInventory(context.supabase, context.userId);
    return pgQuery<StockRow>(
      `select i.id as item_id, i.name as item_name, i.category, i.subcategory,
              coalesce(ib.balance, 0)::float as qty,
              coalesce(i.min_sale_price, i.estimated_value)::float as unit_price
       from items i
       left join inventory_balance ib on ib.item_id = i.id
       where i.active is not false
         and coalesce(i.deleted_at, 'epoch'::timestamptz) = 'epoch'::timestamptz
         and i.category = any($1::text[])
       order by unit_price desc nulls last`,
      [INV_CATEGORIES],
    );
  });

export type LedgerRow = {
  id: number;
  type: string;
  item_id: number | null;
  item_name: string | null;
  qty: number;
  member_id: number | null;
  member_name: string | null;
  created_at: string;
  notes: string | null;
};

export const getLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number; type?: string | null }) => ({
    limit: Math.min(Math.max(d?.limit ?? 100, 1), 500),
    type: d?.type ?? null,
  }))
  .handler(async ({ data, context }): Promise<LedgerRow[]> => {
    await gateInventory(context.supabase, context.userId);
    const params: unknown[] = [data.limit, INV_CATEGORIES];
    let where = "where i.category = any($2::text[])";
    if (data.type) {
      params.push(data.type);
      where += ` and im.movement_type = $${params.length}`;
    }
    return pgQuery<LedgerRow>(
      `select im.id, im.movement_type as type, im.item_id, i.name as item_name,
              im.quantity as qty,
              im.member_id, m.display_name as member_name,
              im.created_at, im.notes
       from inventory_movements im
       join items i on i.id = im.item_id
       left join members m on m.id = im.member_id
       ${where}
       order by im.created_at desc
       limit $1`,
      params,
    );
  });

// Used by other pages (operações). No inventory gate.
export const listMembersLite = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    return pgQuery<{ id: number; label: string }>(
      `select id, coalesce(display_name, username, nickname, discord_id) as label
       from members where deleted_at is null order by label`,
    );
  });
