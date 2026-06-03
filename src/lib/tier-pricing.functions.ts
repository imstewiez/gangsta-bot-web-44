import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { logAdminAction } from "./logging.functions";
import { resolveCurrentMember } from "./pricing.server";

export type ItemTierSurcharge = {
  id: number;
  item_id: number;
  tier: string;
  surcharge: number;
  price_with_material: number | null;
  price_without_material: number | null;
};

export async function getSurchargesForItems(itemIds: number[]): Promise<Map<number, Map<string, ItemTierSurcharge>>> {
  if (itemIds.length === 0) return new Map();
  try {
    const rows = await pgQuery<ItemTierSurcharge>(
      `select id, item_id, tier,
              coalesce(surcharge, 0)::float as surcharge,
              price_with_material::float as price_with_material,
              price_without_material::float as price_without_material
         from item_tier_surcharges
        where item_id = any($1::int[])`,
      [itemIds]
    );
    const map = new Map<number, Map<string, ItemTierSurcharge>>();
    for (const row of rows) {
      if (!map.has(row.item_id)) map.set(row.item_id, new Map());
      map.get(row.item_id)!.set(row.tier, {
        ...row,
        surcharge: Number(row.surcharge) || 0,
        price_with_material: row.price_with_material == null ? null : Number(row.price_with_material),
        price_without_material: row.price_without_material == null ? null : Number(row.price_without_material),
      });
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function getSurchargeForItem(itemId: number): Promise<Map<string, ItemTierSurcharge>> {
  const map = await getSurchargesForItems([itemId]);
  return map.get(itemId) ?? new Map();
}

export const listItemTierSurcharges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ItemTierSurcharge[]> => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) return [];
    return pgQuery<ItemTierSurcharge>(
      `select id, item_id, tier,
              coalesce(surcharge, 0)::float as surcharge,
              price_with_material::float as price_with_material,
              price_without_material::float as price_without_material
         from item_tier_surcharges
        order by item_id, tier`
    );
  });

function cleanNullableMoney(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error("preço inválido");
  return Math.round(n);
}

export const upsertItemTierSurcharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { item_id: number; tier: string; surcharge?: number; price_with_material?: number | null; price_without_material?: number | null }) => {
    if (!Number.isFinite(d.item_id) || d.item_id <= 0) throw new Error("item_id inválido");
    if (!d.tier || d.tier.length > 80) throw new Error("tier obrigatório");
    const surcharge = Number(d.surcharge ?? 0);
    if (!Number.isFinite(surcharge)) throw new Error("acréscimo inválido");
    return {
      item_id: Number(d.item_id),
      tier: d.tier.trim(),
      surcharge,
      price_with_material: cleanNullableMoney(d.price_with_material),
      price_without_material: cleanNullableMoney(d.price_without_material),
    };
  })
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Acesso restrito à chefia.");

    const { item_id, tier, surcharge, price_with_material, price_without_material } = data;
    const isEmpty = surcharge === 0 && price_with_material == null && price_without_material == null;

    if (isEmpty) {
      await pgQuery(
        `delete from item_tier_surcharges where item_id = $1 and tier = $2`,
        [item_id, tier],
      );
      return { id: null, deleted: true };
    }

    const result = await pgOne<{ id: number }>(
      `insert into item_tier_surcharges (item_id, tier, surcharge, price_with_material, price_without_material)
       values ($1, $2, $3, $4, $5)
       on conflict (item_id, tier) do update set
         surcharge = excluded.surcharge,
         price_with_material = excluded.price_with_material,
         price_without_material = excluded.price_without_material,
         updated_at = now()
       returning id`,
      [item_id, tier, surcharge, price_with_material, price_without_material],
    );

    void logAdminAction(context.supabase, {
      action: "update_tier_prices",
      actorId: context.userId,
      actorName: me.display_name ?? "Direção",
      targetType: "item",
      targetId: item_id,
      details: `Preços ${tier}: com material ${price_with_material ?? "base"}€, sem material ${price_without_material ?? "base"}€`,
    }).catch(() => undefined);

    return result;
  });

export const deleteItemTierSurcharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { item_id: number; tier: string }) => {
    if (!Number.isFinite(d.item_id) || d.item_id <= 0) throw new Error("item_id inválido");
    if (!d.tier) throw new Error("tier obrigatório");
    return d;
  })
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Acesso restrito à chefia.");

    const { item_id, tier } = data;

    await pgQuery(
      `delete from item_tier_surcharges where item_id = $1 and tier = $2`,
      [item_id, tier]
    );

    void logAdminAction(context.supabase, {
      action: "delete_tier_prices",
      actorId: context.userId,
      actorName: me.display_name ?? "Direção",
      targetType: "item",
      targetId: item_id,
      details: `Removidos preços ${tier}`,
    }).catch(() => undefined);

    return { success: true };
  });
