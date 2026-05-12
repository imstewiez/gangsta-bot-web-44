import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";

// ----- Tier helpers (pure, safe to use anywhere) -----
export const TIER_LABELS: Record<string, string> = {
  young_blood: "YB (Bairrista N1)",
  o_gunao: "GN (Bairrista N2)",
  gangster_fodido: "GF (Bairrista N3)",
  patrao_di_zona: "Patrão di Zona",
  real_gangster: "Real Gangster",
  og: "OG",
  kingpin: "Kingpin",
  manda_chuva: "Manda-Chuva",
};

const TIER_MARGIN: Record<string, number> = {
  young_blood: 0.015,
  o_gunao: 0.01,
  gangster_fodido: 0.005,
  patrao_di_zona: 0,
  real_gangster: 0,
  og: 0,
  kingpin: 0,
  manda_chuva: 0,
};

export function tierMargin(tier: string | null | undefined): number {
  if (!tier) return 0;
  return TIER_MARGIN[tier] ?? 0;
}

const MANAGER_TIERS = new Set(["patrao_di_zona", "kingpin", "manda_chuva"]);
export function isManager(member: { tier: string | null; role_label?: string | null } | null): boolean {
  if (!member) return false;
  if (member.tier && MANAGER_TIERS.has(member.tier)) return true;
  if (member.role_label === "chefia" || member.role_label === "manda_chuva") return true;
  return false;
}

// ----- Server helper: resolve current member from Supabase user -----
export type CurrentMember = {
  id: number;
  discord_id: string | null;
  display_name: string | null;
  tier: string | null;
  role_label: string | null;
  is_manager: boolean;
};

export async function resolveCurrentMember(
  supabase: { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { discord_id: string | null } | null }> } } } },
  userId: string
): Promise<CurrentMember | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("discord_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!profile?.discord_id) return null;
  const m = await pgOne<{
    id: number; discord_id: string | null; display_name: string | null;
    tier: string | null; role_label: string | null;
  }>(
    `select id, discord_id, display_name, tier, coalesce(role,'bairrista') as role_label
     from members where discord_id = $1 and deleted_at is null limit 1`,
    [profile.discord_id]
  );
  if (!m) return null;
  return { ...m, is_manager: isManager(m) };
}

export const getCurrentMember = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CurrentMember | null> => {
    return resolveCurrentMember(context.supabase, context.userId);
  });

// ----- Catalog -----
export type CatalogItem = {
  id: number;
  name: string;
  category: string;
  subcategory: string | null;
  side: "compra" | "venda";
  purchase_price: number | null;
  morador_purchase_price: number | null;
  min_sale_price: number | null;
};

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
       order by side, subcategory, name`
    );
  });
