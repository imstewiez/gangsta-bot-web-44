-- Sincronizar all_time_stats com dados reais das tabelas de transação
-- E recalcular weekly_rankings para semanas recentes com tipos de movimento corretos

-- 1. Sincronizar all_time_stats kills_total a partir de kill_logs
UPDATE all_time_stats s
SET kills_total = COALESCE((
  SELECT COUNT(*) FROM kill_logs WHERE killer_id = s.member_id
), 0),
updated_at = now();

-- 2. Sincronizar all_time_stats deaths_total a partir de operation_participants
UPDATE all_time_stats s
SET deaths_total = COALESCE((
  SELECT COUNT(*) FROM operation_participants p
  JOIN operations o ON o.id = p.operation_id
  WHERE p.member_id = s.member_id AND p.died = true AND o.deleted_at IS NULL
), 0),
updated_at = now();

-- 3. Sincronizar all_time_stats saidas_total a partir de operation_participants
UPDATE all_time_stats s
SET saidas_total = COALESCE((
  SELECT COUNT(*) FROM operation_participants WHERE member_id = s.member_id
), 0),
updated_at = now();

-- 4. Sincronizar all_time_stats deliveries a partir de inventory_movements
UPDATE all_time_stats s
SET deliveries = COALESCE((
  SELECT COUNT(*) FROM inventory_movements
  WHERE member_id = s.member_id AND movement_type IN ('entrega_bairrista', 'entrega_oficial')
), 0),
updated_at = now();

-- 5. Sincronizar all_time_stats sales a partir de inventory_movements
UPDATE all_time_stats s
SET sales = COALESCE((
  SELECT COUNT(*) FROM inventory_movements
  WHERE member_id = s.member_id AND movement_type = 'venda_bairrista'
), 0),
updated_at = now();

-- 6. Sincronizar all_time_stats orders a partir de orders
UPDATE all_time_stats s
SET orders = COALESCE((
  SELECT COUNT(*) FROM orders WHERE member_id = s.member_id
), 0),
updated_at = now();

-- 7. Sincronizar all_time_stats wins/losses a partir de operations
UPDATE all_time_stats s
SET wins = COALESCE((
  SELECT COUNT(*) FROM operation_participants p
  JOIN operations o ON o.id = p.operation_id
  WHERE p.member_id = s.member_id AND o.was_profitable = true AND o.deleted_at IS NULL
), 0),
losses = COALESCE((
  SELECT COUNT(*) FROM operation_participants p
  JOIN operations o ON o.id = p.operation_id
  WHERE p.member_id = s.member_id AND (o.was_profitable = false OR o.was_profitable IS NULL) AND o.deleted_at IS NULL
), 0),
updated_at = now();

-- 8. Recalcular weekly_rankings para semanas com dados (últimas 8 semanas)
-- Primeiro apagar semanas recentes que foram computadas com tipos errados
DELETE FROM weekly_rankings WHERE week_start >= '2026-04-20';

-- Recalcular cada semana individualmente
DO $$
DECLARE
  ws date;
  we date;
BEGIN
  FOR ws IN
    SELECT DISTINCT date_trunc('week', d)::date
    FROM generate_series('2026-04-20'::date, current_date, '1 day'::interval) d
  LOOP
    we := ws + interval '6 days';

    -- Inserir dados da semana
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
END $$;
