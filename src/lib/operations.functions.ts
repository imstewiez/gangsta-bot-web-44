import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery } from "./pg.server";

export type SaidaRow = {
  id: number;
  tipo: string | null;
  spot: string | null;
  status: string;
  scheduled_at: string | null;
  finalized_at: string | null;
  participant_count: number;
};

export const listSaidas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<SaidaRow[]> => {
    return pgQuery<SaidaRow>(
      `select o.id, o.tipo, o.spot, o.status,
              o.scheduled_at, o.finalized_at,
              (select count(*)::int from operation_participants op where op.operation_id = o.id) as participant_count
       from operations o
       order by coalesce(o.scheduled_at, o.created_at) desc
       limit 100`
    );
  });

export type KillRow = {
  id: number;
  member_id: number | null;
  member_name: string | null;
  victim: string | null;
  weapon: string | null;
  notes: string | null;
  created_at: string;
};

export const listKills = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<KillRow[]> => {
    return pgQuery<KillRow>(
      `select k.id, k.member_id, m.display_name as member_name,
              k.victim, k.weapon, k.notes, k.created_at
       from kill_logs k
       left join members m on m.id = k.member_id
       order by k.created_at desc
       limit 100`
    );
  });

export type RankRow = {
  member_id: number;
  display_name: string | null;
  nick: string | null;
  score: number;
  contribution: number | null;
  performance: number | null;
  reliability: number | null;
};

export const getWeeklyTop = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<RankRow[]> => {
    return pgQuery<RankRow>(
      `select wr.member_id, m.display_name, m.nick,
              wr.score::float as score,
              wr.contribution_score::float as contribution,
              wr.performance_score::float as performance,
              wr.reliability_score::float as reliability
       from weekly_rankings wr
       join members m on m.id = wr.member_id
       where wr.week_start = (select max(week_start) from weekly_rankings)
       order by wr.score desc nulls last
       limit 50`
    ).catch(() => []);
  });
