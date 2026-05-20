-- Sincronizar todas as sequences com o valor máximo actual de cada tabela
-- Isto corrige o erro "duplicate key value violates unique constraint"
-- que acontece quando os dados foram migrados mas as sequences não foram actualizadas.

-- Mapping: sequence_name -> table_name
-- Algumas sequences têm nomes diferentes das tabelas (ex: cemetery_kills_id_seq -> kill_logs)

SELECT setval('archival_log_id_seq',            COALESCE((SELECT MAX(id) FROM archival_log), 0) + 1, false);
SELECT setval('audit_logs_id_seq',              COALESCE((SELECT MAX(id) FROM audit_logs), 0) + 1, false);
SELECT setval('availability_sessions_id_seq',   COALESCE((SELECT MAX(id) FROM availability_sessions), 0) + 1, false);
SELECT setval('availability_slots_id_seq',      COALESCE((SELECT MAX(id) FROM availability_slots), 0) + 1, false);
SELECT setval('availability_votes_id_seq',      COALESCE((SELECT MAX(id) FROM availability_votes), 0) + 1, false);
SELECT setval('bot_messages_id_seq',            COALESCE((SELECT MAX(id) FROM bot_messages), 0) + 1, false);
SELECT setval('cemetery_kills_id_seq',          COALESCE((SELECT MAX(id) FROM kill_logs), 0) + 1, false);
SELECT setval('craft_recipes_id_seq',           COALESCE((SELECT MAX(id) FROM craft_recipes), 0) + 1, false);
SELECT setval('incidents_id_seq',               COALESCE((SELECT MAX(id) FROM incidents), 0) + 1, false);
SELECT setval('inventory_movements_id_seq',     COALESCE((SELECT MAX(id) FROM inventory_movements), 0) + 1, false);
SELECT setval('item_price_history_id_seq',      COALESCE((SELECT MAX(id) FROM item_price_history), 0) + 1, false);
SELECT setval('items_id_seq',                   COALESCE((SELECT MAX(id) FROM items), 0) + 1, false);
SELECT setval('job_runs_id_seq',                COALESCE((SELECT MAX(id) FROM job_runs), 0) + 1, false);
SELECT setval('managed_topic_categories_id_seq', COALESCE((SELECT MAX(id) FROM managed_topic_categories), 0) + 1, false);
SELECT setval('member_absences_id_seq',         COALESCE((SELECT MAX(id) FROM member_absences), 0) + 1, false);
SELECT setval('member_lifecycle_history_id_seq', COALESCE((SELECT MAX(id) FROM member_lifecycle_history), 0) + 1, false);
SELECT setval('member_pvp_ratings_id_seq',      COALESCE((SELECT MAX(id) FROM member_pvp_ratings), 0) + 1, false);
SELECT setval('member_role_history_id_seq',     COALESCE((SELECT MAX(id) FROM member_role_history), 0) + 1, false);
SELECT setval('members_id_seq',                 COALESCE((SELECT MAX(id) FROM members), 0) + 1, false);
SELECT setval('monthly_rankings_id_seq',        COALESCE((SELECT MAX(id) FROM monthly_rankings), 0) + 1, false);
SELECT setval('operation_materials_id_seq',     COALESCE((SELECT MAX(id) FROM operation_materials), 0) + 1, false);
SELECT setval('operation_participants_id_seq',  COALESCE((SELECT MAX(id) FROM operation_participants), 0) + 1, false);
SELECT setval('operations_id_seq',              COALESCE((SELECT MAX(id) FROM operations), 0) + 1, false);
SELECT setval('order_status_history_id_seq',    COALESCE((SELECT MAX(id) FROM order_status_history), 0) + 1, false);
SELECT setval('orders_id_seq',                  COALESCE((SELECT MAX(id) FROM orders), 0) + 1, false);
SELECT setval('pending_notifications_id_seq',   COALESCE((SELECT MAX(id) FROM pending_notifications), 0) + 1, false);
SELECT setval('price_list_messages_id_seq',     COALESCE((SELECT MAX(id) FROM price_list_messages), 0) + 1, false);
SELECT setval('radio_history_id_seq',           COALESCE((SELECT MAX(id) FROM radio_history), 0) + 1, false);
SELECT setval('recipe_ingredients_id_seq',      COALESCE((SELECT MAX(id) FROM recipe_ingredients), 0) + 1, false);
SELECT setval('resident_channels_id_seq',       COALESCE((SELECT MAX(id) FROM resident_channels), 0) + 1, false);
SELECT setval('saida_countdowns_id_seq',        COALESCE((SELECT MAX(id) FROM saida_countdowns), 0) + 1, false);
SELECT setval('sticky_messages_id_seq',         COALESCE((SELECT MAX(id) FROM sticky_messages), 0) + 1, false);
SELECT setval('stock_v3_movements_id_seq',      COALESCE((SELECT MAX(id) FROM stock_v3_movements), 0) + 1, false);
SELECT setval('stock_v3_pricing_id_seq',        COALESCE((SELECT MAX(id) FROM stock_v3_pricing), 0) + 1, false);
SELECT setval('sync_retries_id_seq',            COALESCE((SELECT MAX(id) FROM sync_retries), 0) + 1, false);
SELECT setval('tag_requests_id_seq',            COALESCE((SELECT MAX(id) FROM tag_requests), 0) + 1, false);
SELECT setval('weekly_prizes_id_seq',           COALESCE((SELECT MAX(id) FROM weekly_prizes), 0) + 1, false);
SELECT setval('weekly_rankings_id_seq',         COALESCE((SELECT MAX(id) FROM weekly_rankings), 0) + 1, false);
