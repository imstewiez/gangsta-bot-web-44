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
 * For kills, prefer the most detailed source available per operation:
 * kill_logs -> participant kills -> operation our_kills.
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
       ), op_rollup as (
         select
           vo.id,
           vo.was_profitable,
           coalesce(nullif(count(distinct kl.id), 0), nullif(sum(coalesce(p.kills, 0)), 0), vo.our_kills, 0)::int as kills,
           count(distinct p.id) filter (where p.died = true)::int as deaths
         from valid_ops vo
         left join kill_logs kl on kl.saida_id = vo.id
         left join operation_participants p on p.operation_id = vo.id
         group by vo.id, vo.was_profitable, vo.our_kills
       )
       select
         coalesce(sum(kills), 0)::int as kills,
         coalesce(sum(deaths), 0)::int as deaths,
         count(*) filter (where was_profitable = true)::int as wins,
         count(*)::int as saidas
       from op_rollup`,
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
