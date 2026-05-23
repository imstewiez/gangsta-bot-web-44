-- ============================================================
-- CLEANUP SCRIPT: imStewie, Angel Power, Mafarrico
-- ============================================================
-- PASSO 1: Identificar os membros
-- ============================================================

-- Procurar membros pelos nomes (case-insensitive, parcial match)
SELECT id, display_name, username, nickname, discord_id, role, status, created_at
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
ORDER BY display_name;

-- ============================================================
-- PASSO 2: Contar o que vai ser eliminado (APENAS VERIFICAÇÃO)
-- ============================================================

-- ENCOMENDAS (orders)
SELECT 'orders' as tabela, m.display_name as membro, COUNT(*) as total
FROM orders o
JOIN members m ON m.id = o.member_id
WHERE o.member_id IN (
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
)
GROUP BY m.display_name;

-- ENTREGAS (inventory_delivery_requests)
SELECT 'delivery_requests' as tabela, m.display_name as membro, COUNT(*) as total
FROM inventory_delivery_requests r
JOIN members m ON m.id = r.requester_member_id
WHERE r.requester_member_id IN (
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
)
GROUP BY m.display_name;

-- VENDAS / SAÍDAS (inventory_movements)
SELECT 'inventory_movements' as tabela, m.display_name as membro, COUNT(*) as total
FROM inventory_movements mv
JOIN members m ON m.id = mv.member_id
WHERE mv.member_id IN (
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
)
  AND mv.movement_type IN ('saida', 'venda', 'sale')
GROUP BY m.display_name;

-- KILLS do imStewie
SELECT 'kill_logs' as tabela, m.display_name as membro, COUNT(*) as total
FROM kill_logs k
JOIN members m ON m.id = k.killer_id
WHERE k.killer_id IN (
    SELECT id FROM members
    WHERE LOWER(display_name) ILIKE '%imstewie%'
       OR LOWER(username) ILIKE '%imstewie%'
       OR LOWER(nickname) ILIKE '%imstewie%'
)
GROUP BY m.display_name;

-- ============================================================
-- PASSO 3: VERIFICAR SE HÁ EXATAMENTE 30 KILLS (ou próximo)
-- ============================================================
SELECT k.id, k.victim_name, k.spot, k.notes, k.date, k.created_at, k.created_by
FROM kill_logs k
JOIN members m ON m.id = k.killer_id
WHERE LOWER(m.display_name) ILIKE '%imstewie%'
   OR LOWER(m.username) ILIKE '%imstewie%'
   OR LOWER(m.nickname) ILIKE '%imstewie%'
ORDER BY k.created_at DESC;
