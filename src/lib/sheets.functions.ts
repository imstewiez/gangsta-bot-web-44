import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";

export type SheetSyncRow = {
  tab_key: string;
  last_synced_at: string | null;
  last_result: string | null;
  last_ops: number | null;
  last_ms: number | null;
  last_error: string | null;
  consecutive_errors: number | null;
  updated_at: string | null;
};

export const listSheetSyncState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<SheetSyncRow[]> => {
    return pgQuery<SheetSyncRow>(
      `select tab_key, last_synced_at, last_result, last_ops, last_ms,
              last_error, consecutive_errors, updated_at
         from sheet_sync_state
        order by tab_key`
    );
  });

/**
 * Marca uma tab como "dirty" (consecutive_errors=0, last_data_hash=null) para
 * que o worker do bot a re-sincronize na próxima passagem. Não tenta falar
 * com a Google Sheets diretamente — mantém-se uma única fonte de verdade.
 */
export const requestSheetResync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tab_key: string }) => {
    if (!d.tab_key?.trim()) throw new Error("tab_key obrigatório");
    return d;
  })
  .handler(async ({ data, context }) => {
    const updated = await pgOne<{ tab_key: string }>(
      `update sheet_sync_state
          set last_data_hash = null,
              consecutive_errors = 0,
              last_error = null,
              updated_at = now()
        where tab_key = $1
        returning tab_key`,
      [data.tab_key.trim()]
    );
    if (!updated) throw new Error("tab desconhecida");
    await pgOne(
      `insert into audit_logs (action, entity_type, entity_id, actor_id, created_at)
       values ('sheet_resync_requested','sheet_sync_state',$1,$2,now()) returning id`,
      [data.tab_key, `web:${context.userId}`]
    );
    return { ok: true };
  });
