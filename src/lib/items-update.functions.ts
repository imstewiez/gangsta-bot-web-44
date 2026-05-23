import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery } from "./pg.server";
import { resolveCurrentMember } from "./pricing.server";

export const updateItemsList = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Verify manager
    const me = await resolveCurrentMember(context.supabase, context.userId);
    if (!me?.is_manager) throw new Error("Sem permissão");

    // Remove items from venda (set side = 'compra' or inactive)
    const toRemove = ["Bullpup Rifle MK2", "Gadget Pistol", "Revolver"];
    for (const name of toRemove) {
      await pgQuery(
        `update items set side = 'compra', updated_at = now() where name = $1`,
        [name],
      );
    }

    // Update Combat PDW price
    await pgQuery(
      `update items set min_sale_price = 60000, updated_at = now() where name = $1`,
      ["Combat PDW"],
    );

    return { ok: true, removed: toRemove, updated: ["Combat PDW"] };
  });
