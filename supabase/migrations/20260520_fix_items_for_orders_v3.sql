-- Primeiro, listar todos os corpos e prints existentes (para confirmar nomes)
-- SELECT id, name, category, min_sale_price, side FROM items WHERE category IN ('corpos', 'prints') ORDER BY category, name;

-- Atualizar TODOS os corpos para venda com preços corretos
UPDATE items SET side = 'venda', active = true, updated_at = now(), min_sale_price = 10000 
WHERE category = 'corpos' AND (name ILIKE '%mini smg%' OR name ILIKE '%uzi%');

UPDATE items SET side = 'venda', active = true, updated_at = now(), min_sale_price = 10000 
WHERE category = 'corpos' AND (name ILIKE '%xm3%' OR name ILIKE '%pistol xm3%');

UPDATE items SET side = 'venda', active = true, updated_at = now(), min_sale_price = 15000 
WHERE category = 'corpos' AND name ILIKE '%micro smg%';

UPDATE items SET side = 'venda', active = true, updated_at = now(), min_sale_price = 15000 
WHERE category = 'corpos' AND (name ILIKE '%tec-9%' OR name ILIKE '%tec 9%' OR name ILIKE '%tec9%');

UPDATE items SET side = 'venda', active = true, updated_at = now(), min_sale_price = 20000 
WHERE category = 'corpos' AND name ILIKE '%tec pistol%';

UPDATE items SET side = 'venda', active = true, updated_at = now(), min_sale_price = 20000 
WHERE category = 'corpos' AND name ILIKE '%ap pistol%';

-- Atualizar TODAS as prints para venda com preços corretos
UPDATE items SET side = 'venda', active = true, updated_at = now(), min_sale_price = 10000 
WHERE category = 'prints' AND name ILIKE '%laranja%';

UPDATE items SET side = 'venda', active = true, updated_at = now(), min_sale_price = 50000 
WHERE category = 'prints' AND name ILIKE '%azul%';

UPDATE items SET side = 'venda', active = true, updated_at = now(), min_sale_price = 70000 
WHERE category = 'prints' AND name ILIKE '%vermelh%';

UPDATE items SET side = 'venda', active = true, updated_at = now(), min_sale_price = 100000 
WHERE category = 'prints' AND (name ILIKE '%amarel%' OR name ILIKE '%dourad%');

-- Se algum corpo/print ainda não foi atualizado, forçar side=venda e active=true
UPDATE items SET side = 'venda', active = true, updated_at = now() 
WHERE category IN ('corpos', 'prints') AND side != 'venda';
