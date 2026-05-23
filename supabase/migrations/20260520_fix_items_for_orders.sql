-- Atualizar prints para venda com preços corretos
UPDATE items SET side = 'venda', min_sale_price = 10000, active = true, updated_at = now() 
WHERE category = 'prints' AND name ILIKE '%laranja%';

UPDATE items SET side = 'venda', min_sale_price = 50000, active = true, updated_at = now() 
WHERE category = 'prints' AND name ILIKE '%azul%';

UPDATE items SET side = 'venda', min_sale_price = 70000, active = true, updated_at = now() 
WHERE category = 'prints' AND name ILIKE '%vermelh%';

UPDATE items SET side = 'venda', min_sale_price = 100000, active = true, updated_at = now() 
WHERE category = 'prints' AND name ILIKE '%amarel%';

-- Atualizar corpos para venda com preços corretos
UPDATE items SET side = 'venda', min_sale_price = 10000, active = true, updated_at = now() 
WHERE category = 'corpos' AND name ILIKE '%mini smg%';

UPDATE items SET side = 'venda', min_sale_price = 10000, active = true, updated_at = now() 
WHERE category = 'corpos' AND name ILIKE '%xm3%';

UPDATE items SET side = 'venda', min_sale_price = 15000, active = true, updated_at = now() 
WHERE category = 'corpos' AND name ILIKE '%micro smg%';

UPDATE items SET side = 'venda', min_sale_price = 15000, active = true, updated_at = now() 
WHERE category = 'corpos' AND name ILIKE '%tec-9%';

UPDATE items SET side = 'venda', min_sale_price = 20000, active = true, updated_at = now() 
WHERE category = 'corpos' AND name ILIKE '%tec pistol%';

UPDATE items SET side = 'venda', min_sale_price = 20000, active = true, updated_at = now() 
WHERE category = 'corpos' AND name ILIKE '%ap pistol%';

-- Remover itens que não devem aparecer na venda
UPDATE items SET side = 'compra', updated_at = now() 
WHERE name IN ('Bullpup Rifle MK2', 'Gadget Pistol', 'Revolver');

-- Atualizar Combat PDW para 60k
UPDATE items SET min_sale_price = 60000, updated_at = now() 
WHERE name = 'Combat PDW';
