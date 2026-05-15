import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook que ouve mudanças em tabelas Supabase via Realtime
 * e invalida as queries correspondentes automaticamente.
 */
export function useRealtimeSync(tables: string[]) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channels = tables.map((table) =>
      supabase
        .channel(`table-changes-${table}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => {
            queryClient.invalidateQueries({ queryKey: [table] });
          }
        )
        .subscribe()
    );

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [queryClient, tables]);
}
