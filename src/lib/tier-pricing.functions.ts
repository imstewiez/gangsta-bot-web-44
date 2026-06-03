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

let ensureTierPriceColumnsPromise: Promise<void> | null = null;

async function ensureTierPriceColumns() {
  ensureTierPriceColumnsPromise ??= (async () => {
    await pgQuery(`alter table public.item_tier_surcharges add column if not exists price_with_material numeric`);
    await pgQuery(`alter table public.item_tier_surcharges add column if not exists price_without_material numeric`);
  })();
  return ensureTierPriceColumnsPromise;
}

const TIER_ALIASES: Record<string, string> = {
  young_blood: "young_blood",
  youngblood: "young_blood",
  bairrista: "young_blood",
  morador: "young_blood",
  standard: "young_blood",
  oficial: "young_blood",
  nivel_1: "young_blood",
  nivel1: "young_blood",
  level_1: "young_blood",
  level1: "young_blood",
  tier_1: "young_blood",
  tier1: "young_blood",
  bairrista_1: "young_blood",
  bairrista1: "young_blood",
  b1: "young_blood",

  o_gunao: "o_gunao",
  gunao: "o_gunao",
  nivel_2: "o_gunao",
  nivel2: "o_gunao",
  level_2: "o_gunao",
  level2: "o_gunao",
  tier_2: "o_gunao",
  tier2: "o_gunao",
  bairrista_2: "o_gunao",
  bairrista2: "o_gunao",
  b2: "o_gunao",

  gangster_fodido: "gangster_fodido",
  gangster: "gangster_fodido",
  nivel_3: "gangster_fodido",
  nivel3: "gangster_fodido",
  level_3: "gangster_fodido",
  level3: "gangster_fodido",
  tier_3: "gangster_fodido",
  tier3: "gangster_fodido",
  bairrista_3: "gangster_fodido",
  bairrista3: "gangster_fodido",
  b3: "gangster_fodido",
};

function normalizeTierKey(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function canonicalTierKey(value: unknown): string {
  const clean = normalizeTierKey(value);
  return TIER_ALIASES[clean] ?? clean;
}

function aliasesForCanonical(canonical: string): string[] {
  const aliases = Object.entries(TIER_ALIASES)
    .filter(([, target]) => target === canonical)
    .map(([alias]) => alias);
  return Array.from(new Set([canonical, ...aliases]));
}

function asNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanRow(row: ItemTierSurcharge): ItemTierSurcharge {
  return {
    ...row,
    tier: canonicalTierKey(row.tier),
    surcharge: Number(row.surcharge) || 0,
    price_with_material: asNumber(row.price_with_material),
    price_without_material: asNumber(row.price_without_material),
  };
}

function mergeOverride(existing: ItemTierSurcharge | undefined, incomingRaw: ItemTierSurcharge): ItemTierSurcharge {
  const incoming = cleanRow(incomingRaw);
  if (!existing) return incoming;

  const incomingHasExplicit = incoming.price_with_material != null || incoming.price_without_material != null;
  const existingHasExplicit = existing.price_with_material != null || existing.price_without_material != null;

  return {
    ...existing,
    id: Math.max(existing.id, incoming.id),
    tier: incoming.tier,
    surcharge: incomingHasExplicit || !existingHasExplicit || incoming.id >= existing.id ? incoming.surcharge : existing.surcharge,
    price_with_material: incoming.price_with_material ?? existing.price_with_material,
    price_without_material: incoming.price_without_material ?? existing.price_without_material,
  };
}

function mapRows(rows: ItemTierSurcharge[]): Map<number, Map<string, ItemTierSurcharge>> {
  const map = new Map<number, Map<string, ItemTierSurcharge>>();
  for (const row of rows) {
    const canonical = canonicalTierKey(row.tier);
    if (!canonical) continue;
    if (!map.has(row.item_id)) map.set(row.item_id, new Map());
    const perItem = map.get(row.item_id)!;
    perItem.set(canonical, mergeOverride(perItem.get(canonical), { ...row, tier: canonical }));
  }
  return map;
}

export async function getSurchargesForItems(itemIds: number[]): Promise<Map<number, Map<string, ItemTierSurcharge>>> {
  if (itemIds.length === 0) return new Map();
  await ensureTierPriceColumns();

  const rows = await pgQuery<ItemTierSurcharge>(
    `select id, item_id, tier,
            coalesce(surcharge, 0)::float as surcharge,
            price_with_material::float as price_with_material,
            price_without_material::float as price_without_material
       from item_tier_surcharges
      where item_id = any($1::int[])`,
    [itemIds],
  );

  return mapRows(rows);
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
    await ensureTierPriceColumns();
    const rows = await pgQuery<ItemTierSurcharge>(
      `select id, item_id, tier,
              coalesce(surcharge, 0)::float as surcharge,
              price_with_material::float as price_with_material,
              price_without_material::float as price_without_material
         from item_tier_surcharges
        order by item_id, tier`,
    );
    return Array.from(mapRows(rows).values()).flatMap((perItem) => Array.from(perItem.values()));
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
      tier: canonicalTierKey(d.tier.trim()),
      surcharge,
      price_with_material: cleanNullableMoney(d.price_with_material),
      price_without_material: cleanNullableMoney(d.price_without_material),
    };
  })
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Acesso restrito à chefia.");
    await ensureTierPriceColumns();

    const { item_id, tier, surcharge, price_with_material, price_without_material } = data;
    const isEmpty = surcharge === 0 && price_with_material == null && price_without_material == null;
    const aliases = aliasesForCanonical(tier);

    if (isEmpty) {
      await pgQuery(`delete from item_tier_surcharges where item_id = $1 and tier = any($2::text[])`, [item_id, aliases]);
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

    void pgQuery(
      `delete from item_tier_surcharges where item_id = $1 and id <> $2 and tier = any($3::text[])`,
      [item_id, result.id, aliases],
    ).catch(() => undefined);

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
    return { item_id: d.item_id, tier: canonicalTierKey(d.tier) };
  })
  .handler(async ({ data, context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Acesso restrito à chefia.");
    await ensureTierPriceColumns();
    await pgQuery(`delete from item_tier_surcharges where item_id = $1 and tier = any($2::text[])`, [data.item_id, aliasesForCanonical(data.tier)]);

    void logAdminAction(context.supabase, {
      action: "delete_tier_prices",
      actorId: context.userId,
      actorName: me.display_name ?? "Direção",
      targetType: "item",
      targetId: data.item_id,
      details: `Removidos preços ${data.tier}`,
    }).catch(() => undefined);

    return { success: true };
  });
