// Standalone data recovery script
// Run with: bun scripts/recover-data.ts
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://zducvbkozxtacwzvggli.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function exec(sql: string) {
  const { data, error } = await (supabase as any).rpc("exec_sql", { sql_query: sql });
  if (error) throw error;
  return (data as any[] | null) ?? [];
}

async function diagnose() {
  console.log("\n=== DIAGNÓSTICO ===");
  const tables = [
    "members", "profiles", "user_roles", "all_time_stats",
    "kill_logs", "operations", "operation_participants",
    "inventory_movements", "inventory_balance",
    "orders", "order_status_history", "order_comments",
    "availability_sessions", "availability_slots", "availability_votes",
    "weekly_rankings", "items", "craft_recipes", "recipe_ingredients",
    "tag_requests", "audit_logs", "notifications",
  ];

  for (const t of tables) {
    try {
      const rows = await exec(`select count(*)::int as c from ${t}`);
      console.log(`  ✅ ${t}: ${rows[0]?.c ?? 0} registos`);
    } catch (e: any) {
      console.log(`  ❌ ${t}: ERRO — ${e?.message ?? e}`);
    }
  }
}

async function ensureTables() {
  console.log("\n=== VERIFICAR TABELAS ===");

  await exec(`create table if not exists order_comments (
    id serial primary key,
    order_id int not null references orders(id) on delete cascade,
    author_id int references members(id) on delete set null,
    author_name text,
    content text not null,
    created_at timestamptz default now()
  )`);
  await exec(`create index if not exists idx_order_comments_order_id on order_comments(order_id)`);
  console.log("  ✅ order_comments");

  await exec(`create table if not exists order_status_history (
    id serial primary key,
    order_id int not null references orders(id) on delete cascade,
    old_status text,
    new_status text not null,
    changed_by text,
    notes text,
    created_at timestamptz default now()
  )`);
  await exec(`create index if not exists idx_osh_order_id on order_status_history(order_id)`);
  console.log("  ✅ order_status_history");

  await exec(`create table if not exists availability_sessions (
    id serial primary key,
    session_date date not null,
    status text default 'open',
    header_text text,
    created_at timestamptz default now(),
    deleted_at timestamptz
  )`);
  console.log("  ✅ availability_sessions");

  await exec(`create table if not exists availability_slots (
    id serial primary key,
    session_id int not null references availability_sessions(id) on delete cascade,
    slot_label text not null,
    position int not null default 0,
    created_at timestamptz default now()
  )`);
  console.log("  ✅ availability_slots");

  await exec(`create table if not exists availability_votes (
    id serial primary key,
    session_id int not null references availability_sessions(id) on delete cascade,
    slot_id int not null references availability_slots(id) on delete cascade,
    discord_user_id text not null,
    vote_state text not null default 'yes',
    created_at timestamptz default now(),
    unique(session_id, slot_id, discord_user_id)
  )`);
  console.log("  ✅ availability_votes");

  await exec(`create table if not exists weekly_rankings (
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
  )`);
  console.log("  ✅ weekly_rankings");

  await exec(`create table if not exists all_time_stats (
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
  )`);
  console.log("  ✅ all_time_stats");

  await exec(`create table if not exists notifications (
    id serial primary key,
    discord_id text,
    type text not null,
    title text not null,
    body text,
    link text,
    read boolean default false,
    created_at timestamptz default now()
  )`);
  console.log("  ✅ notifications");
}

async function recalcStats() {
  console.log("\n=== RECALCULAR all_time_stats ===");
  // Ensure total_score column exists
  await exec(`ALTER TABLE all_time_stats ADD COLUMN IF NOT EXISTS total_score int DEFAULT 0`);
  await exec(`with
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
             coalesce(l.losses, 0) as losses
      from members m
      left join kills_src k on k.member_id = m.id
      left join deaths_src d on d.member_id = m.id
      left join saidas_src s on s.member_id = m.id
      left join deliveries_src de on de.member_id = m.id
      left join sales_src sa on sa.member_id = m.id
      left join orders_src o on o.member_id = m.id
      left join wins_src w on w.member_id = m.id
      left join losses_src l on l.member_id = m.id
      where m.deleted_at is null
    )
    insert into all_time_stats (member_id, kills_total, deaths_total, saidas_total, deliveries, sales, orders, wins, losses, total_score, updated_at)
    select member_id, kills_total, deaths_total, saidas_total, deliveries, sales, orders, wins, losses,
           (kills_total * 3 + deliveries * 2 + sales * 2 + saidas_total * 2 + wins * 4 - deaths_total) as total_score,
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
  const rows = await exec(`select count(*)::int as c from all_time_stats`);
  console.log(`  ✅ all_time_stats atualizado — ${rows[0]?.c ?? 0} membros`);
}

async function recalcWeekly() {
  console.log("\n=== RECALCULAR weekly_rankings ===");
  await exec(`delete from weekly_rankings where week_start >= '2026-04-20'`);

  await exec(`DO $$
    DECLARE
      ws date;
      we date;
    BEGIN
      FOR ws IN
        SELECT DISTINCT date_trunc('week', d)::date
        FROM generate_series('2026-04-20'::date, current_date, '1 day'::interval) d
      LOOP
        we := ws + interval '6 days';

        INSERT INTO weekly_rankings (
          member_id, week_start, week_end, deliveries, sales, operations_count,
          weighted_value, return_rate, rank_position, kills_count, wins_count, loss_count,
          net_profit_generated, survival_rate, performance_score, hybrid_score, normalized_score, created_at
        )
        WITH bounds AS (SELECT ws AS ws, we AS we),
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
                 CASE WHEN COALESCE(o.operations_count, 0) > 0
                      THEN COALESCE(o.survived_in_ops, 0)::numeric / COALESCE(o.operations_count, 1)
                      ELSE 0
                 END AS survival_rate,
                 COALESCE(k.kills_count, 0) + COALESCE(o.wins_count, 0) * 2 - COALESCE(o.deaths_in_ops, 0) * 0.5 AS performance_score,
                 COALESCE(k.kills_count, 0) + COALESCE(o.wins_count, 0) * 2 - COALESCE(o.deaths_in_ops, 0) * 0.5 +
                   CASE WHEN COALESCE(o.operations_count, 0) > 0
                        THEN (COALESCE(o.survived_in_ops, 0)::numeric / COALESCE(o.operations_count, 1)) * 50
                        ELSE 0
                   END +
                   COALESCE(o.net_profit_generated, 0) * 0.001 AS hybrid_score
          FROM members m
          LEFT JOIN kills k ON k.member_id = m.id
          LEFT JOIN ops o ON o.member_id = m.id
          LEFT JOIN inv d ON d.member_id = m.id
          LEFT JOIN sales s ON s.member_id = m.id
          WHERE m.deleted_at IS NULL
            AND (m.status = 'ativo' OR m.status IS NULL AND COALESCE(m.lifecycle_state::text, 'active') IN ('active', 'promoted'))
            AND (COALESCE(k.kills_count, 0) + COALESCE(o.operations_count, 0) + COALESCE(d.deliveries, 0) + COALESCE(s.sales, 0) > 0)
        ),
        ranked AS (
          SELECT *,
                 ROW_NUMBER() OVER (ORDER BY hybrid_score DESC) AS rank_position,
                 MAX(hybrid_score) OVER () AS max_score
          FROM computed
        )
        SELECT member_id, ws, we, deliveries, sales, operations_count,
               net_profit_generated, survival_rate, rank_position,
               kills_count, wins_count, loss_count,
               net_profit_generated, survival_rate, performance_score, hybrid_score,
               CASE WHEN max_score > 0 THEN hybrid_score / max_score ELSE 0 END,
               now()
        FROM ranked
        ORDER BY hybrid_score DESC;

      END LOOP;
    END $$`
  );

  const rows = await exec(`select count(*)::int as c from weekly_rankings`);
  console.log(`  ✅ weekly_rankings atualizado — ${rows[0]?.c ?? 0} registos`);
}

async function main() {
  console.log("🔧 Ballas Gang — Data Recovery");
  console.log("==============================");

  await diagnose();
  await ensureTables();
  await recalcStats();
  await recalcWeekly();

  console.log("\n✅ Recuperação completa!");
}

main().catch((e) => {
  console.error("❌ Erro:", e);
  process.exit(1);
});
