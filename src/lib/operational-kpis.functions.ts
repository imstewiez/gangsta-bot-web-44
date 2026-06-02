import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgOne } from "./pg.server";

type OperationalKpis = {
  kills: number;
  deaths: number;
  wins: number;
  saidas: number;
  kda: number;
  winRate: number;
};

/**
 * Operational KPIs for the dashboard.
 * Only completed operations with a defined result count towards winrate/KDA.
 * Operations without victory/defeat are intentionally ignored.
 */
export const getOperationalKpis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<OperationalKpis> => {
    const row = await pgOne<{
      kills: number;
      deaths: number;
      wins: number;
      saidas: number;
    }>(
      `with valid_ops as (
         select id, coalesce(our_kills, 0)::int as our_kills, was_profitable
         from operations
         where deleted_at is null
           and status = 'concluida'
           and was_profitable is not null
       ), participant_deaths as (
         select p.operation_id, count(*) filter (where p.died = true)::int as deaths
         from operation_participants p
         join valid_ops vo on vo.id = p.operation_id
         group by p.operation_id
       )
       select
         coalesce(sum(vo.our_kills), 0)::int as kills,
         coalesce(sum(coalesce(pd.deaths, 0)), 0)::int as deaths,
         count(*) filter (where vo.was_profitable = true)::int as wins,
         count(*)::int as saidas
       from valid_ops vo
       left join participant_deaths pd on pd.operation_id = vo.id`,
    ).catch(() => ({ kills: 0, deaths: 0, wins: 0, saidas: 0 }));

    const kills = Number(row?.kills ?? 0);
    const deaths = Number(row?.deaths ?? 0);
    const wins = Number(row?.wins ?? 0);
    const saidas = Number(row?.saidas ?? 0);

    return {
      kills,
      deaths,
      wins,
      saidas,
      kda: deaths > 0 ? Number((kills / deaths).toFixed(2)) : kills,
      winRate: saidas > 0 ? Math.round((wins / saidas) * 100) : 0,
    };
  });
