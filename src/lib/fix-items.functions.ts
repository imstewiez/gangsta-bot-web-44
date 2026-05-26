import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";

export const fixItems = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Sem permissão");

    const results: string[] = [];

    // ── Corpos (subcategory = 'corpos') ──────────────────────────────────────
    const corpoMap: Record<string, number> = {
      "Corpo Mini SMG": 10000,
      "Corpo Pistol XM3": 10000,
      "Corpo Micro SMG": 15000,
      "Corpo TEC-9": 15000,
      "Corpo UZI": 15000,
      "Corpo TEC Pistol": 20000,
      "Corpo AP Pistol": 20000,
    };

    for (const [name, price] of Object.entries(corpoMap)) {
      const rows = await pgQuery<{ name: string }>(
        `UPDATE items SET side = 'venda', active = true, updated_at = now(), min_sale_price = $1 
         WHERE subcategory = 'corpos' AND name = $2 
         RETURNING name`,
        [price, name],
      );
      if (rows.length > 0) {
        for (const r of rows) results.push(`Corpo: ${r.name} → ${price}€`);
      }
    }

    // ── Prints (name ILIKE '%print%') ────────────────────────────────────────
    const printMap: Record<string, number> = {
      "Print Laranja": 10000,
      "Print Azul": 50000,
      "Print Vermelha": 70000,
      "Print Amarela": 100000,
    };

    for (const [name, price] of Object.entries(printMap)) {
      const rows = await pgQuery<{ name: string }>(
        `UPDATE items SET side = 'venda', active = true, updated_at = now(), min_sale_price = $1 
         WHERE name = $2 
         RETURNING name`,
        [price, name],
      );
      if (rows.length > 0) {
        for (const r of rows) results.push(`Print: ${r.name} → ${price}€`);
      }
    }

    // ── Remover da venda ─────────────────────────────────────────────────────
    const toRemove = ["Bullpup Rifle MK2", "Gadget Pistol", "Revolver"];
    for (const name of toRemove) {
      await pgQuery(
        `UPDATE items SET side = 'compra', updated_at = now() WHERE name = $1`,
        [name],
      );
      results.push(`Removido: ${name}`);
    }

    // ── Combat PDW ───────────────────────────────────────────────────────────
    const pdw = await pgQuery<{ name: string }>(
      `UPDATE items SET min_sale_price = 60000, updated_at = now() WHERE name = 'Combat PDW' RETURNING name`,
      [],
    );
    if (pdw.length > 0) results.push(`Combat PDW → 60000€`);

    return { updated: results.length, items: results };
  });
