// Data recovery & diagnostics — superadmin only.
// These functions help rebuild derived tables when data is lost or inconsistent.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pgQuery, pgOne } from "./pg.server";
import { assertSuperAdmin } from "./admin.functions";

export type TableHealth = {
  table_name: string;
  row_count: number;
  healthy: boolean;
};

export const diagnoseDatabase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);

    const tables = [
      "members",
      "profiles",
      "user_roles",
      "all_time_stats",
      "kill_logs",
      "operations",
      "operation_participants",
      "inventory_movements",
      "inventory_balance",
      "orders",
      "order_status_history",
      "availability_sessions",
      "availability_slots",
      "availability_votes",
      "weekly_rankings",
      "items",
      "craft_recipes",
      "recipe_ingredients",
      "tag_requests",
      "audit_logs",
      "notifications",
      "order_comments",
    ];

    const results: TableHealth[] = [];
    for (const t of tables) {
      try {
        const r = await pgOne<{ count: number }>(
          `select count(*)::int as count from ${t}`,
        );
        results.push({ table_name: t, row_count: r?.count ?? 0, healthy: true });
      } catch (e) {
        results.push({ table_name: t, row_count: 0, healthy: false });
      }
    }
    return results;
  });

export const recalcAllTimeStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);

    await pgQuery(
      `with
       kills_logs_src as (
         select killer_id as member_id, count(*)::int as kills_total
         from kill_logs where killer_id is not null group by killer_id
       ),
       kills_ops_src as (
         select p.member_id, sum(p.kills)::int as kills_total
         from operation_participants p
         join operations o on o.id = p.operation_id and o.deleted_at is null
         where o.status = 'concluida' and p.kills > 0
         group by p.member_id
       ),
       kills_src as (
         select coalesce(l.member_id, o.member_id) as member_id,
                coalesce(l.kills_total, 0) + coalesce(o.kills_total, 0) as kills_total
         from kills_logs_src l
         full outer join kills_ops_src o on l.member_id = o.member_id
       ),
       deaths_src as (
         select p.member_id, count(*) filter (where p.died = true)::int as deaths_total
         from operation_participants p
         join operations o on o.id = p.operation_id and o.deleted_at is null
         where o.status = 'concluida'
         group by p.member_id
       ),
       saidas_src as (
         select p.member_id, count(*)::int as saidas_total
         from operation_participants p
         join operations o on o.id = p.operation_id and o.deleted_at is null
         where o.status = 'concluida'
         group by p.member_id
       ),
       deliveries_src as (
         select member_id, count(*)::int as deliveries
         from inventory_movements
         where movement_type in ('entrega_bairrista','entrega_oficial') and member_id is not null
         group by member_id
       ),
       sales_src as (
         select member_id, count(*)::int as sales
         from inventory_movements
         where movement_type = 'venda_bairrista' and member_id is not null
         group by member_id
       ),
       material_pts as (
         select im.member_id, coalesce(sum(abs(im.quantity) * i.xp_points), 0)::int as material_points
         from inventory_movements im
         join items i on i.id = im.item_id
         where im.movement_type in ('entrega_bairrista','entrega_oficial') and im.member_id is not null
         group by im.member_id
       ),
       sales_pts as (
         select im.member_id, coalesce(sum(abs(im.quantity) * i.xp_points), 0)::int as sales_points
         from inventory_movements im
         join items i on i.id = im.item_id
         where im.movement_type = 'venda_bairrista' and im.member_id is not null
         group by im.member_id
       ),
       orders_src as (
         select member_id, count(*)::int as orders
         from orders
         where member_id is not null
         group by member_id
       ),
       wins_src as (
         select p.member_id, count(*)::int as wins
         from operation_participants p
         join operations o on o.id = p.operation_id and o.deleted_at is null
         where o.status = 'concluida' and o.was_profitable = true
         group by p.member_id
       ),
       losses_src as (
         select p.member_id, count(*)::int as losses
         from operation_participants p
         join operations o on o.id = p.operation_id and o.deleted_at is null
         where o.status = 'concluida' and (o.was_profitable = false or o.was_profitable is null)
         group by p.member_id
       ),
       combined as (
         select m.id as member_id,
                coalesce(k.kills_total, 0) as kills_total,
                coalesce(d.deaths_total, 0) as deaths_total,
                coalesce(s.saidas_total, 0) as saidas_total,
                coalesce(de.deliveries, 0) as deliveries,
                coalesce(sa.sales, 0) as sales,
                coalesce(o.orders, 0) as orders,
                coalesce(w.wins, 0) as wins,
                coalesce(l.losses, 0) as losses,
                coalesce(mp.material_points, 0) as material_points,
                coalesce(sp.sales_points, 0) as sales_points
         from members m
         left join kills_src k on k.member_id = m.id
         left join deaths_src d on d.member_id = m.id
         left join saidas_src s on s.member_id = m.id
         left join deliveries_src de on de.member_id = m.id
         left join sales_src sa on sa.member_id = m.id
         left join orders_src o on o.member_id = m.id
         left join wins_src w on w.member_id = m.id
         left join losses_src l on l.member_id = m.id
         left join material_pts mp on mp.member_id = m.id
         left join sales_pts sp on sp.member_id = m.id
         where m.deleted_at is null
       )
       insert into all_time_stats (member_id, kills_total, deaths_total, saidas_total, deliveries, sales, orders, wins, losses, total_score, updated_at)
       select member_id, kills_total, deaths_total, saidas_total, deliveries, sales, orders, wins, losses,
              (material_points + sales_points + (wins + losses) * 5 + wins * 10 + kills_total * 3 - deaths_total * 5) as total_score,
              now()
       from combined
       on conflict (member_id) do update set
         kills_total = excluded.kills_total,
         deaths_total = excluded.deaths_total,
         saidas_total = excluded.saidas_total,
         deliveries = excluded.deliveries,
         sales = excluded.sales,
         orders = excluded.orders,
         wins = excluded.wins,
         losses = excluded.losses,
         total_score = excluded.total_score,
         updated_at = now()`
    );

    const r = await pgOne<{ count: number }>(`select count(*)::int as count from all_time_stats`);
    return { rows_updated: r?.count ?? 0 };
  });

export const ensureCriticalTables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);

    // order_comments
    await pgQuery(
      `create table if not exists order_comments (
        id serial primary key,
        order_id int not null references orders(id) on delete cascade,
        author_id int references members(id) on delete set null,
        author_name text,
        content text not null,
        created_at timestamptz default now()
      )`
    );
    await pgQuery(`create index if not exists idx_order_comments_order_id on order_comments(order_id)`);

    // order_status_history
    await pgQuery(
      `create table if not exists order_status_history (
        id serial primary key,
        order_id int not null references orders(id) on delete cascade,
        old_status text,
        new_status text not null,
        changed_by text,
        notes text,
        created_at timestamptz default now()
      )`
    );
    await pgQuery(`create index if not exists idx_osh_order_id on order_status_history(order_id)`);

    // availability_sessions
    await pgQuery(
      `create table if not exists availability_sessions (
        id serial primary key,
        session_date date not null,
        status text default 'open',
        header_text text,
        created_at timestamptz default now(),
        deleted_at timestamptz
      )`
    );

    // availability_slots
    await pgQuery(
      `create table if not exists availability_slots (
        id serial primary key,
        session_id int not null references availability_sessions(id) on delete cascade,
        slot_label text not null,
        position int not null default 0,
        created_at timestamptz default now()
      )`
    );

    // availability_votes
    await pgQuery(
      `create table if not exists availability_votes (
        id serial primary key,
        session_id int not null references availability_sessions(id) on delete cascade,
        slot_id int not null references availability_slots(id) on delete cascade,
        discord_user_id text not null,
        vote_state text not null default 'yes',
        created_at timestamptz default now(),
        unique(session_id, slot_id, discord_user_id)
      )`
    );

    // weekly_rankings
    await pgQuery(
      `create table if not exists weekly_rankings (
        id serial primary key,
        member_id int not null references members(id) on delete cascade,
        week_start date not null,
        week_end date not null,
        deliveries int default 0,
        sales int default 0,
        operations_count int default 0,
        weighted_value numeric default 0,
        return_rate numeric default 0,
        rank_position int default 0,
        kills_count int default 0,
        wins_count int default 0,
        loss_count int default 0,
        net_profit_generated numeric default 0,
        survival_rate numeric default 0,
        performance_score numeric default 0,
        hybrid_score numeric default 0,
        normalized_score numeric default 0,
        material_points int default 0,
        sales_points int default 0,
        ops_points int default 0,
        total_score int default 0,
        created_at timestamptz default now(),
        unique(member_id, week_start)
      )`
    );

    // all_time_stats if missing entirely
    await pgQuery(
      `create table if not exists all_time_stats (
        id serial primary key,
        member_id int not null unique references members(id) on delete cascade,
        kills_total int default 0,
        deaths_total int default 0,
        saidas_total int default 0,
        deliveries int default 0,
        sales int default 0,
        orders int default 0,
        wins int default 0,
        losses int default 0,
        updated_at timestamptz default now()
      )`
    );

    // notifications
    await pgQuery(
      `create table if not exists notifications (
        id serial primary key,
        discord_id text,
        type text not null,
        title text not null,
        body text,
        link text,
        read boolean default false,
        created_at timestamptz default now()
      )`
    );

    return { ok: true };
  });

export async function doRecalcWeeklyRankings(): Promise<{ rows_updated: number }> {
  // Clear recent weeks and recalculate
  await pgQuery(`delete from weekly_rankings where week_start >= '2026-04-20'`);

  const weekRows = await pgQuery<{ ws: string }>(
    `select distinct date_trunc('week', d)::date::text as ws
     from generate_series('2026-04-20'::date, current_date, '1 day'::interval) d
     order by 1`
  );

  for (const row of weekRows) {
    const ws = row.ws;
    await pgQuery(
      `INSERT INTO weekly_rankings (
        member_id, week_start, week_end, deliveries, sales, operations_count,
        weighted_value, return_rate, rank_position, kills_count, wins_count, loss_count,
        net_profit_generated, survival_rate, performance_score, hybrid_score, normalized_score, total_score, created_at
      )
      WITH bounds AS (SELECT $1::date AS ws, ($1::date + interval '6 days')::date AS we),
      kills AS (
        SELECT killer_id AS member_id, COUNT(*)::int AS kills_count
        FROM kill_logs, bounds
        WHERE date BETWEEN bounds.ws AND bounds.we AND killer_id IS NOT NULL
        GROUP BY killer_id
      ),
      ops AS (
        SELECT p.member_id,
               COUNT(*)::int AS operations_count,
               COUNT(*) FILTER (WHERE o.was_profitable = true)::int AS wins_count,
               COUNT(*) FILTER (WHERE o.was_profitable = false OR o.was_profitable IS NULL)::int AS loss_count,
               COUNT(*) FILTER (WHERE p.died)::int AS deaths_in_ops,
               COUNT(*) FILTER (WHERE p.survived)::int AS survived_in_ops,
               COALESCE(SUM(p.net_material_delta), 0)::numeric AS net_profit_generated
        FROM operation_participants p
        JOIN operations o ON o.id = p.operation_id AND o.deleted_at IS NULL
        CROSS JOIN bounds
        WHERE COALESCE(o.end_time, o.start_time, o.date::timestamp) BETWEEN bounds.ws AND bounds.we + interval '1 day'
          AND o.status = 'concluida'
        GROUP BY p.member_id
      ),
      inv AS (
        SELECT member_id, COUNT(*)::int AS deliveries
        FROM inventory_movements, bounds
        WHERE created_at BETWEEN bounds.ws AND bounds.we + interval '1 day'
          AND movement_type IN ('entrega_bairrista', 'entrega_oficial')
          AND member_id IS NOT NULL
        GROUP BY member_id
      ),
      sales AS (
        SELECT member_id, COUNT(*)::int AS sales
        FROM inventory_movements, bounds
        WHERE created_at BETWEEN bounds.ws AND bounds.we + interval '1 day'
          AND movement_type = 'venda_bairrista'
          AND member_id IS NOT NULL
        GROUP BY member_id
      ),
      weighted AS (
        SELECT member_id, SUM(quantity)::int AS weighted_value
        FROM inventory_movements, bounds
        WHERE created_at BETWEEN bounds.ws AND bounds.we + interval '1 day'
          AND movement_type IN ('entrega_bairrista', 'venda_bairrista', 'entrega_oficial')
          AND member_id IS NOT NULL
        GROUP BY member_id
      ),
      return_rates AS (
        SELECT p.member_id, COALESCE(AVG(p.discipline_score), 0)::numeric AS return_rate
        FROM operation_participants p
        JOIN operations o ON o.id = p.operation_id AND o.deleted_at IS NULL
        CROSS JOIN bounds
        WHERE COALESCE(o.end_time, o.start_time, o.date::timestamp) BETWEEN bounds.ws AND bounds.we + interval '1 day'
          AND o.status = 'concluida'
        GROUP BY p.member_id
      ),
      computed AS (
        SELECT m.id AS member_id,
               COALESCE(k.kills_count, 0) AS kills_count,
               COALESCE(o.operations_count, 0) AS operations_count,
               COALESCE(o.wins_count, 0) AS wins_count,
               COALESCE(o.loss_count, 0) AS loss_count,
               COALESCE(o.deaths_in_ops, 0) AS deaths_in_ops,
               COALESCE(o.survived_in_ops, 0) AS survived_in_ops,
               COALESCE(o.net_profit_generated, 0) AS net_profit_generated,
               COALESCE(d.deliveries, 0) AS deliveries,
               COALESCE(s.sales, 0) AS sales,
               COALESCE(w.weighted_value, 0) AS weighted_value,
               COALESCE(r.return_rate, 0) AS return_rate,
               CASE WHEN COALESCE(o.operations_count, 0) > 0
                    THEN COALESCE(o.survived_in_ops, 0)::numeric / COALESCE(o.operations_count, 1)
                    ELSE 0
               END AS survival_rate,
               COALESCE(k.kills_count, 0) * 10 + COALESCE(o.wins_count, 0) * 20 - COALESCE(o.loss_count, 0) * 5 + COALESCE(o.net_profit_generated, 0) / 100 + COALESCE(o.operations_count, 0) * 3 AS performance_score,
               COALESCE(w.weighted_value, 0) * 0.4 +
               (COALESCE(k.kills_count, 0) * 10 + COALESCE(o.wins_count, 0) * 20 - COALESCE(o.loss_count, 0) * 5 + COALESCE(o.net_profit_generated, 0) / 100 + COALESCE(o.operations_count, 0) * 3) * 0.4 +
               (COALESCE(r.return_rate, 0) * 0.5 + CASE WHEN COALESCE(o.operations_count, 0) > 0 THEN (COALESCE(o.survived_in_ops, 0)::numeric / COALESCE(o.operations_count, 1)) * 0.3 ELSE 0 END) * 0.2 AS hybrid_score
        FROM members m
        LEFT JOIN kills k ON k.member_id = m.id
        LEFT JOIN ops o ON o.member_id = m.id
        LEFT JOIN inv d ON d.member_id = m.id
        LEFT JOIN sales s ON s.member_id = m.id
        LEFT JOIN weighted w ON w.member_id = m.id
        LEFT JOIN return_rates r ON r.member_id = m.id
        WHERE m.deleted_at IS NULL
          AND m.role = 'bairrista'
          AND (m.status = 'ativo' OR m.status IS NULL AND COALESCE(m.lifecycle_state::text, 'active') IN ('active', 'promoted'))
          AND (COALESCE(k.kills_count, 0) + COALESCE(o.operations_count, 0) + COALESCE(d.deliveries, 0) + COALESCE(s.sales, 0) > 0)
      ),
      ranked AS (
        SELECT *,
               ROW_NUMBER() OVER (ORDER BY hybrid_score DESC) AS rank_position,
               MAX(hybrid_score) OVER () AS max_score
        FROM computed
      )
      SELECT member_id, bounds.ws, bounds.we, deliveries, sales, operations_count,
             weighted_value, return_rate, rank_position,
             kills_count, wins_count, loss_count,
             net_profit_generated, survival_rate, performance_score, hybrid_score,
             CASE WHEN max_score > 0 THEN hybrid_score / max_score ELSE 0 END,
             ROUND(hybrid_score)::int,
             now()
      FROM ranked, bounds
      ORDER BY hybrid_score DESC`,
      [ws]
    );
  }

  const r = await pgOne<{ count: number }>(`select count(*)::int as count from weekly_rankings`);

  // Auto-generate prize for the most recent week if not already exists
  const top = await pgOne<{
    member_id: number;
    week_start: string;
    week_end: string;
    score: number | null;
  }>(
    `select wr.member_id, wr.week_start, wr.week_end,
            coalesce(wr.hybrid_score, wr.normalized_score, wr.performance_score)::float as score
     from weekly_rankings wr
     where wr.week_start = (select max(week_start) from weekly_rankings)
     order by score desc nulls last
     limit 1`,
  );
  if (top) {
    const existing = await pgOne<{ id: number }>(
      `select id from weekly_prizes where week_start = $1`,
      [top.week_start],
    );
    if (!existing) {
      await pgQuery(
        `insert into weekly_prizes
           (week_start, week_end, winner_member_id, hybrid_score, prize_status, created_at, updated_at)
         values ($1, $2, $3, $4, 'por_definir', now(), now())`,
        [top.week_start, top.week_end, top.member_id, top.score],
      );
    }
  }

  return { rows_updated: r?.count ?? 0 };
}

export const recalcWeeklyRankings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context.userId);
    return doRecalcWeeklyRankings();
  });
