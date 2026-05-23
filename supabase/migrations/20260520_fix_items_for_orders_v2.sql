-- Corpos - atualizar TODOS os corpos para venda com preços baseados no nome
UPDATE items SET side = 'venda', active = true, updated_at = now() 
WHERE category = 'corpos' AND name ILIKE '%mini smg%' AND (min_sale_price IS NULL OR min_sale_price = 0 OR min_sale_price = 600);
UPDATE items SET min_sale_price = 10000, updated_at = now() 
WHERE category = 'corpos' AND name ILIKE '%mini smg%';

UPDATE items SET side = 'venda', active = true, updated_at = now() 
WHERE category = 'corpos' AND name ILIKE '%xm3%' AND (min_sale_price IS NULL OR min_sale_price = 0 OR min_sale_price = 600);
UPDATE items SET min_sale_price = 10000, updated_at = now() 
WHERE category = 'corpos' AND name ILIKE '%xm3%';

UPDATE items SET side = 'venda', active = true, updated_at = now() 
WHERE category = 'corpos' AND name ILIKE '%micro smg%' AND (min_sale_price IS NULL OR min_sale_price = 0 OR min_sale_price = 600);
UPDATE items SET min_sale_price = 15000, updated_at = now() 
WHERE category = 'corpos' AND name ILIKE '%micro smg%';

UPDATE items SET side = 'venda', active = true, updated_at = now() 
WHERE category = 'corpos' AND (name ILIKE '%tec-9%' OR name ILIKE '%tec 9%') AND (min_sale_price IS NULL OR min_sale_price = 0 OR min_sale_price = 600);
UPDATE items SET min_sale_price = 15000, updated_at = now() 
WHERE category = 'corpos' AND (name ILIKE '%tec-9%' OR name ILIKE '%tec 9%');

UPDATE items SET side = 'venda', active = true, updated_at = now() 
WHERE category = 'corpos' AND name ILIKE '%tec pistol%' AND (min_sale_price IS NULL OR min_sale_price = 0 OR min_sale_price = 600);
UPDATE items SET min_sale_price = 20000, updated_at = now() 
WHERE category = 'corpos' AND name ILIKE '%tec pistol%';

UPDATE items SET side = 'venda', active = true, updated_at = now() 
WHERE category = 'corpos' AND name ILIKE '%ap pistol%' AND (min_sale_price IS NULL OR min_sale_price = 0 OR min_sale_price = 600);
UPDATE items SET min_sale_price = 20000, updated_at = now() 
WHERE category = 'corpos' AND name ILIKE '%ap pistol%';

-- Prints - atualizar TODAS as prints para venda
UPDATE items SET side = 'venda', active = true, updated_at = now() 
WHERE category = 'prints' AND name ILIKE '%laranja%' AND (min_sale_price IS NULL OR min_sale_price = 0);
UPDATE items SET min_sale_price = 10000, updated_at = now() 
WHERE category = 'prints' AND name ILIKE '%laranja%';

UPDATE items SET side = 'venda', active = true, updated_at = now() 
WHERE category = 'prints' AND name ILIKE '%azul%' AND (min_sale_price IS NULL OR min_sale_price = 0);
UPDATE items SET min_sale_price = 50000, updated_at = now() 
WHERE category = 'prints' AND name ILIKE '%azul%';

UPDATE items SET side = 'venda', active = true, updated_at = now() 
WHERE category = 'prints' AND name ILIKE '%vermelh%' AND (min_sale_price IS NULL OR min_sale_price = 0);
UPDATE items SET min_sale_price = 70000, updated_at = now() 
WHERE category = 'prints' AND name ILIKE '%vermelh%';

UPDATE items SET side = 'venda', active = true, updated_at = now() 
WHERE category = 'prints' AND (name ILIKE '%amarel%' OR name ILIKE '%dourad%') AND (min_sale_price IS NULL OR min_sale_price = 0);
UPDATE items SET min_sale_price = 100000, updated_at = now() 
WHERE category = 'prints' AND (name ILIKE '%amarel%' OR name ILIKE '%dourad%');
