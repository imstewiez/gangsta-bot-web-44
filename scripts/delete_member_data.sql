-- ============================================================
-- DELETE SCRIPT: imStewie, Angel Power, Mafarrico
-- ⚠️  IRREVERSÍVEL — FAZ BACKUP PRIMEIRO!
-- ============================================================

-- Guardar os member_id numa CTE para reutilizar
WITH target_members AS (
    SELECT id, display_name
    FROM members
    WHERE LOWER(display_name) ILIKE '%imstewie%'
       OR LOWER(username) ILIKE '%imstewie%'
       OR LOWER(nickname) ILIKE '%imstewie%'
       OR LOWER(display_name) ILIKE '%angel%power%'
       OR LOWER(username) ILIKE '%angel%power%'
       OR LOWER(nickname) ILIKE '%angel%power%'
       OR LOWER(display_name) ILIKE '%mafarrico%'
       OR LOWER(username) ILIKE '%mafarrico%'
       OR LOWER(nickname) ILIKE '%mafarrico%'
),

-- ============================================================
-- 1. ELIMINAR ENCOMENDAS (orders)
-- ============================================================
deleted_orders AS (
    DELETE FROM orders
    WHERE member_id IN (SELECT id FROM target_members)
    RETURNING id, member_id
)
SELECT 'orders' as tabela, COUNT(*) as eliminados FROM deleted_orders;

-- ============================================================
-- 2. ELIMINAR ENTREGAS (inventory_delivery_requests)
-- ============================================================
WITH target_members AS (
    SELECT id FROM members
    WHERE LOWER(display_name) ILIKE '%imstewie%'
       OR LOWER(username) ILIKE '%imstewie%'
       OR LOWER(nickname) ILIKE '%imstewie%'
       OR LOWER(display_name) ILIKE '%angel%power%'
       OR LOWER(username) ILIKE '%angel%power%'
       OR LOWER(nickname) ILIKE '%angel%power%'
       OR LOWER(display_name) ILIKE '%mafarrico%'
       OR LOWER(username) ILIKE '%mafarrico%'
       OR LOWER(nickname) ILIKE '%mafarrico%'
),
deleted_deliveries AS (
    DELETE FROM inventory_delivery_requests
    WHERE requester_member_id IN (SELECT id FROM target_members)
    RETURNING id, requester_member_id
)
SELECT 'delivery_requests' as tabela, COUNT(*) as eliminados FROM deleted_deliveries;

-- ============================================================
-- 3. ELIMINAR VENDAS / SAÍDAS (inventory_movements)
-- ============================================================
WITH target_members AS (
    SELECT id FROM members
    WHERE LOWER(display_name) ILIKE '%imstewie%'
       OR LOWER(username) ILIKE '%imstewie%'
       OR LOWER(nickname) ILIKE '%imstewie%'
       OR LOWER(display_name) ILIKE '%angel%power%'
       OR LOWER(username) ILIKE '%angel%power%'
       OR LOWER(nickname) ILIKE '%angel%power%'
       OR LOWER(display_name) ILIKE '%mafarrico%'
       OR LOWER(username) ILIKE '%mafarrico%'
       OR LOWER(nickname) ILIKE '%mafarrico%'
),
deleted_movements AS (
    DELETE FROM inventory_movements
    WHERE member_id IN (SELECT id FROM target_members)
      AND movement_type IN ('saida', 'venda', 'sale')
    RETURNING id, member_id
)
SELECT 'inventory_movements (vendas/saidas)' as tabela, COUNT(*) as eliminados FROM deleted_movements;

-- ============================================================
-- 4. ELIMINAR KILLS do imStewie (todas)
-- ============================================================
WITH target_members AS (
    SELECT id FROM members
    WHERE LOWER(display_name) ILIKE '%imstewie%'
       OR LOWER(username) ILIKE '%imstewie%'
       OR LOWER(nickname) ILIKE '%imstewie%'
),
deleted_kills AS (
    DELETE FROM kill_logs
    WHERE killer_id IN (SELECT id FROM target_members)
    RETURNING id, killer_id
)
SELECT 'kill_logs (imStewie)' as tabela, COUNT(*) as eliminados FROM deleted_kills;
