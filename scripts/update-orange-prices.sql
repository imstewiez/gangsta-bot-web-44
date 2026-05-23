-- Atualizar preços de venda (min_sale_price) das armas Orange
-- Executar no Supabase SQL Editor

UPDATE items
SET min_sale_price = 30000, updated_at = now()
WHERE name ILIKE '%mini smg%' AND side = 'venda';

UPDATE items
SET min_sale_price = 35000, updated_at = now()
WHERE name ILIKE '%pistol xm3%' AND side = 'venda';

UPDATE items
SET min_sale_price = 40000, updated_at = now()
WHERE name ILIKE '%micro smg%' AND side = 'venda';

UPDATE items
SET min_sale_price = 45000, updated_at = now()
WHERE name ILIKE '%tec 9%' AND side = 'venda';

UPDATE items
SET min_sale_price = 50000, updated_at = now()
WHERE name ILIKE '%tec pistol%' AND side = 'venda';

UPDATE items
SET min_sale_price = 55000, updated_at = now()
WHERE name ILIKE '%ap pistol%' AND side = 'venda';

UPDATE items
SET min_sale_price = 70000, updated_at = now()
WHERE name ILIKE '%compact rifle%' AND side = 'venda';

UPDATE items
SET min_sale_price = 30000, updated_at = now()
WHERE name ILIKE '%assault shotgun%' AND side = 'venda';

-- Verificar resultados
SELECT name, min_sale_price FROM items
WHERE name ILIKE ANY(ARRAY['%mini smg%', '%pistol xm3%', '%micro smg%', '%tec 9%', '%tec pistol%', '%ap pistol%', '%compact rifle%', '%assault shotgun%'])
  AND side = 'venda'
ORDER BY name;
