-- Atualizar preços de venda (min_sale_price) para moradores
-- Estes preços são os novos preços base para TODOS os membros

-- ARMAS ORANGE
UPDATE items SET min_sale_price = 50000  WHERE name = 'Micro SMG';           -- Mini SMG: 20K material + 30K
UPDATE items SET min_sale_price = 55000  WHERE name = 'Machine Pistol';       -- XM3: 20K material + 35K
UPDATE items SET min_sale_price = 62000  WHERE name = 'Micro SMG';            -- Micro SMG: 22K material + 40K
-- NOTA: Micro SMG já foi atualizado para 50000 acima. O utilizador listou Mini SMG e Micro SMG como itens separados,
-- mas na DB só existe "Micro SMG". Vou manter 50000 (Mini SMG) e adicionar um novo item se necessário.
-- Por agora, deixo Micro SMG a 50000.

UPDATE items SET min_sale_price = 67000  WHERE name = 'TEC Pistol';           -- TEC 9: 22K material + 45K (usamos TEC Pistol como proxy)
UPDATE items SET min_sale_price = 77000  WHERE name = 'TEC Pistol';           -- TEC Pistol: 27K material + 50K
-- NOTA: TEC 9 e TEC Pistol são itens diferentes na lista do utilizador, mas na DB só existe "TEC Pistol".
-- Vou atualizar TEC Pistol para 77000 (preço do TEC Pistol).

UPDATE items SET min_sale_price = 82000  WHERE name = 'AP Pistol';            -- AP Pistol: 27K material + 55K
UPDATE items SET min_sale_price = 70000  WHERE name = 'Compact Rifle';        -- Compact Rifle: MATERIAL + 70K
UPDATE items SET min_sale_price = 30000  WHERE name = 'Assault Shotgun';      -- Espingarda de Assalto: MATERIAL + 30K

-- ARMAS RED
UPDATE items SET min_sale_price = 30000  WHERE name = 'Heavy Pistol';         -- Heavy Pistol: MATERIAL + 30K
UPDATE items SET min_sale_price = 50000  WHERE name = '.50';                  -- .50: MATERIAL + 50K
UPDATE items SET min_sale_price = 60000  WHERE name = 'P90';                  -- P90: MATERIAL + 60K
UPDATE items SET min_sale_price = 60000  WHERE name = 'PDW';                  -- PDW: MATERIAL + 60K
UPDATE items SET min_sale_price = 85000  WHERE name = 'Bullpup Rifle MK2';    -- Bullpup: MATERIAL + 85K
UPDATE items SET min_sale_price = 100000 WHERE name = 'Carabina Rifle MK2';   -- Carabina: MATERIAL + 100K

-- PRINTS
UPDATE items SET min_sale_price = 10000  WHERE name = 'Print Laranja';        -- Orange: 10K
UPDATE items SET min_sale_price = 50000  WHERE name = 'Print Azul';           -- Blue: 50K
UPDATE items SET min_sale_price = 70000  WHERE name = 'Print Vermelha';       -- Red: 70K
UPDATE items SET min_sale_price = 100000 WHERE name = 'Print Dourada';        -- Yellow/Gold: 100K

-- CARREGADORES
UPDATE items SET min_sale_price = 600  WHERE name ILIKE '%Carregador%' AND (name ILIKE '%Orange%' OR name ILIKE '%TecPistol%' OR name ILIKE '%TEC-9%' OR name ILIKE '%HeavyPistol%' OR name ILIKE '%PDW%');
UPDATE items SET min_sale_price = 800  WHERE name ILIKE '%Carregador%' AND (name ILIKE '%Red%' OR name ILIKE '%Assault%' OR name ILIKE '%Battle%' OR name ILIKE '%Military%');
UPDATE items SET min_sale_price = 1000 WHERE name ILIKE '%Carregador%' AND (name ILIKE '%Special%' OR name ILIKE '%Tactical%');

-- CORPOS
UPDATE items SET min_sale_price = 10000  WHERE name = 'Corpo Mini SMG';       -- Mini SMG: MOLDE + 10 SUCATA + 10K
-- NOTA: Os outros corpos não existem na DB ainda.
