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
              coalesce(i.purchase_price, 0)::float as unit_price
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

export const adjustStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { item_id: number; new_qty: number }) => {
    if (!d?.item_id || typeof d.new_qty !== "number") throw new Error("Dados inválidos.");
    return { item_id: d.item_id, new_qty: d.new_qty };
  })
  .handler(async ({ data, context }) => {
    await gateInventory(context.supabase, context.userId);
    // buscar qty atual
    const current = await pgOne<{ balance: number }>(
      `select coalesce(balance, 0)::float as balance from inventory_balance where item_id = $1`,
      [data.item_id],
    );
    const currentQty = current?.balance ?? 0;
    const delta = data.new_qty - currentQty;
    if (delta === 0) return { ok: true };
    await pgQuery(
      `insert into inventory_movements
         (movement_type, item_id, quantity, member_id, location, notes, created_by, created_at)
       values ('ajuste_manual', $1, $2, $3, 'armazem', $4, $5, now())`,
      [
        data.item_id,
        delta,
        null,
        `ajuste: ${currentQty} → ${data.new_qty}`,
        `web:${context.userId}`,
      ],
    );
    return { ok: true };
  });

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
