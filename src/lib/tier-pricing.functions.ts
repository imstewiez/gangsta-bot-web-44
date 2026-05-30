import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { logAdminAction } from "./logging.functions";

export type ItemTierSurcharge = {
  id: number;
  item_id: number;
  tier: string;
  surcharge: number;
};

export async function getSurchargesForItems(itemIds: number[]): Promise<Map<number, Map<string, number>>> {
  if (itemIds.length === 0) return new Map();
  try {
    const rows = await pgQuery<ItemTierSurcharge>(
      `select id, item_id, tier, surcharge from item_tier_surcharges where item_id = any($1::int[])`,
      [itemIds]
    );
    const map = new Map<number, Map<string, number>>();
    for (const row of rows) {
      if (!map.has(row.item_id)) map.set(row.item_id, new Map());
      map.get(row.item_id)!.set(row.tier, row.surcharge);
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function getSurchargeForItem(itemId: number): Promise<Map<string, number>> {
  const map = await getSurchargesForItems([itemId]);
  return map.get(itemId) ?? new Map();
}

export const listItemTierSurcharges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ItemTierSurcharge[]> => {
    return pgQuery<ItemTierSurcharge>(
      `select id, item_id, tier, surcharge from item_tier_surcharges order by item_id, tier`
    );
  });

export const upsertItemTierSurcharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { item_id: number; tier: string; surcharge: number }) => {
    if (!Number.isFinite(d.item_id)) throw new Error("item_id inválido");
    if (!d.tier) throw new Error("tier obrigatório");
    if (!Number.isFinite(d.surcharge) || d.surcharge < 0) throw new Error("surcharge inválido");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { item_id, tier, surcharge } = data;

    const result = await pgOne<{ id: number }>(
      `insert into item_tier_surcharges (item_id, tier, surcharge)
       values ($1, $2, $3)
       on conflict (item_id, tier) do update set surcharge = excluded.surcharge, updated_at = now()
       returning id`,
      [item_id, tier, surcharge]
    );

    await logAdminAction(context.supabase, {
      action: "update_tier_surcharge",
      actorId: context.userId,
      actorName: "Direção",
      targetType: "item",
      targetId: item_id,
      details: `Acréscimo ${tier}: ${surcharge}€`,
    });

    return result;
  });

export const deleteItemTierSurcharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { item_id: number; tier: string }) => {
    if (!Number.isFinite(d.item_id)) throw new Error("item_id inválido");
    if (!d.tier) throw new Error("tier obrigatório");
    return d;
  })
  .handler(async ({ data, context }) => {
    const { item_id, tier } = data;
    if (!Number.isFinite(item_id)) throw new Error("item_id inválido");
    if (!tier) throw new Error("tier obrigatório");

    await pgQuery(
      `delete from item_tier_surcharges where item_id = $1 and tier = $2`,
      [item_id, tier]
    );

    await logAdminAction(context.supabase, {
      action: "delete_tier_surcharge",
      actorId: context.userId,
      actorName: "Direção",
      targetType: "item",
      targetId: item_id,
      details: `Removido acréscimo ${tier}`,
    });

    return { success: true };
  });
