import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook que ouve mudanças em tabelas Supabase via Realtime
 * e invalida as queries correspondentes automaticamente.
 *
 * Pode receber:
 * - strings: ouve a tabela com esse nome e invalida queryKey [table]
 * - objetos: ouve a tabela indicada e invalida as queryKeys especificadas
 */
type SyncConfig = string | { table: string; queryKeys?: string[][] };

export function useRealtimeSync(tables: SyncConfig[]) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channels = tables.map((config) => {
      const table = typeof config === "string" ? config : config.table;
      const queryKeys =
        typeof config === "string"
          ? [[table]]
          : (config.queryKeys ?? [[table]]);

      return supabase
        .channel(`table-changes-${table}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => {
            queryKeys.forEach((qk) =>
              queryClient.invalidateQueries({ queryKey: qk })
            );
          }
        )
        .subscribe();
    });

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [queryClient, tables]);
}
