import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";

export const updatePrintsAndCorpos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Sem permissão");

    // First, list all prints and corpos to verify names
    const existing = await pgQuery<{ name: string; category: string; min_sale_price: number }>(
      `select name, category, min_sale_price::float from items where category in ('prints', 'corpos') and active = true`,
      [],
    );

    // Update prints prices using ILIKE for flexibility
    const printUpdates = [
      { pattern: "%laranja%", price: 10000 },
      { pattern: "%azul%", price: 50000 },
      { pattern: "%vermelh%", price: 70000 },
      { pattern: "%amarel%", price: 100000 },
    ];
    for (const p of printUpdates) {
      await pgQuery(
        `update items set side = 'venda', min_sale_price = $1, active = true, updated_at = now() where category = 'prints' and name ilike $2`,
        [p.price, p.pattern],
      );
    }

    // Update corpos prices using ILIKE
    const corpoUpdates = [
      { pattern: "%mini smg%", price: 10000 },
      { pattern: "%xm3%", price: 10000 },
      { pattern: "%micro smg%", price: 15000 },
      { pattern: "%tec-9%", price: 15000 },
      { pattern: "%tec pistol%", price: 20000 },
      { pattern: "%ap pistol%", price: 20000 },
    ];
    for (const c of corpoUpdates) {
      await pgQuery(
        `update items set side = 'venda', min_sale_price = $1, active = true, updated_at = now() where category = 'corpos' and name ilike $2`,
        [c.price, c.pattern],
      );
    }

    return { ok: true, existing, message: "Prints e corpos atualizados" };
  });
