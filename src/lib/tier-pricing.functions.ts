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
      map.get(row.item_id)!.set(row.tier, Number(row.surcharge) || 0);
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
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) return [];
    return pgQuery<ItemTierSurcharge>(
      `select id, item_id, tier, surcharge from item_tier_surcharges order by item_id, tier`
    );
  });

export const upsertItemTierSurcharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { item_id: number; tier: string; surcharge: number }) => {
    if (!Number.isFinite(d.item_id) || d.item_id <= 0) throw new Error("item_id inválido");
    if (!d.tier || d.tier.length > 80) throw new Error("tier obrigatório");
    if (!Number.isFinite(d.surcharge)) throw new Error("acréscimo inválido");
    return {
      item_id: Number(d.item_id),
      tier: d.tier.trim(),
      surcharge: Number(d.surcharge),
    };
  })
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Acesso restrito à chefia.");

    const { item_id, tier, surcharge } = data;

    // Zero means no override. Delete instead of storing noisy rows.
    if (surcharge === 0) {
      await pgQuery(
        `delete from item_tier_surcharges where item_id = $1 and tier = $2`,
        [item_id, tier],
      );
      return { id: null, deleted: true };
    }

    // Do not rely on a DB unique constraint. Some production DBs were created
    // manually and may not have UNIQUE(item_id, tier), so explicit update/insert
    // is safer than ON CONFLICT.
    const existing = await pgOne<{ id: number }>(
      `select id from item_tier_surcharges where item_id = $1 and tier = $2 order by id asc limit 1`,
      [item_id, tier],
    );

    let result: { id: number } | null = null;
    if (existing) {
      result = await pgOne<{ id: number }>(
        `update item_tier_surcharges set surcharge = $3, updated_at = now() where id = $1 returning id`,
        [existing.id, tier, surcharge],
      );
      await pgQuery(
        `delete from item_tier_surcharges where item_id = $1 and tier = $2 and id <> $3`,
        [item_id, tier, existing.id],
      );
    } else {
      result = await pgOne<{ id: number }>(
        `insert into item_tier_surcharges (item_id, tier, surcharge)
         values ($1, $2, $3)
         returning id`,
        [item_id, tier, surcharge],
      );
    }

    await logAdminAction(context.supabase, {
      action: "update_tier_surcharge",
      actorId: context.userId,
      actorName: me.display_name ?? "Direção",
      targetType: "item",
      targetId: item_id,
      details: `Acréscimo ${tier}: ${surcharge}€`,
    });

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

    await logAdminAction(context.supabase, {
      action: "delete_tier_surcharge",
      actorId: context.userId,
      actorName: me.display_name ?? "Direção",
      targetType: "item",
      targetId: item_id,
      details: `Removido acréscimo ${tier}`,
    });

    return { success: true };
  });
