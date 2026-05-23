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

    // Atualizar todos os corpos
    const corpoUpdates = [
      { pattern: "%mini smg%", price: 10000 },
      { pattern: "%xm3%", price: 10000 },
      { pattern: "%micro smg%", price: 15000 },
      { pattern: "%tec-9%", price: 15000 },
      { pattern: "%tec 9%", price: 15000 },
      { pattern: "%tec9%", price: 15000 },
      { pattern: "%tec pistol%", price: 20000 },
      { pattern: "%ap pistol%", price: 20000 },
    ];
    for (const c of corpoUpdates) {
      const rows = await pgQuery<{ name: string }>(
        `UPDATE items SET side = 'venda', active = true, updated_at = now(), min_sale_price = $1 
         WHERE category = 'corpos' AND name ILIKE $2 
         RETURNING name`,
        [c.price, c.pattern],
      );
      for (const r of rows) results.push(`Corpo: ${r.name} → ${c.price}€`);
    }

    // Atualizar todas as prints
    const printUpdates = [
      { pattern: "%laranja%", price: 10000 },
      { pattern: "%azul%", price: 50000 },
      { pattern: "%vermelh%", price: 70000 },
      { pattern: "%amarel%", price: 100000 },
      { pattern: "%dourad%", price: 100000 },
    ];
    for (const p of printUpdates) {
      const rows = await pgQuery<{ name: string }>(
        `UPDATE items SET side = 'venda', active = true, updated_at = now(), min_sale_price = $1 
         WHERE category = 'prints' AND name ILIKE $2 
         RETURNING name`,
        [p.price, p.pattern],
      );
      for (const r of rows) results.push(`Print: ${r.name} → ${p.price}€`);
    }

    // Remover da venda
    const toRemove = ["Bullpup Rifle MK2", "Gadget Pistol", "Revolver"];
    for (const name of toRemove) {
      await pgQuery(
        `UPDATE items SET side = 'compra', updated_at = now() WHERE name = $1`,
        [name],
      );
      results.push(`Removido: ${name}`);
    }

    // Combat PDW
    const pdw = await pgQuery<{ name: string }>(
      `UPDATE items SET min_sale_price = 60000, updated_at = now() WHERE name = 'Combat PDW' RETURNING name`,
      [],
    );
    if (pdw.length > 0) results.push(`Combat PDW → 60000€`);

    return { updated: results.length, items: results };
  });
