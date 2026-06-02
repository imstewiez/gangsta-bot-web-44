-- Configura preços de compra de materiais na fonte de verdade: public.items.
-- purchase_price = preço para civil
-- morador_purchase_price = preço para organização/morador
-- estimated_value acompanha o preço de compra para manter custos internos/receitas consistentes.
-- Só atualiza itens já existentes; não cria itens novos.

WITH target_prices(name, price) AS (
  VALUES
    ('Taninos', 20),
    ('Radio Estragado', 25),
    ('Rádio Estragado', 25),
    ('Telemóvel Estragado', 25),
    ('Telemovel Estragado', 25),
    ('Sucata', 40),
    ('Serradura', 40),
    ('Carvão', 40),
    ('Carvao', 40),
    ('Tábua Pinho', 40),
    ('Tabua Pinho', 40),
    ('Plastico Reciclado', 40),
    ('Plástico Reciclado', 40),
    ('Tábua Carvalho', 65),
    ('Tabua Carvalho', 65),
    ('Borracha', 65),
    ('Tábua Cerejeira', 60),
    ('Tabua Cerejeira', 60),
    ('Ferro', 65),
    ('Tecido', 65),
    ('Cobre', 65),
    ('Lixo Eletrônico', 60),
    ('Lixo Eletrónico', 60),
    ('Lixo Eletronico', 60),
    ('Pólvora', 100),
    ('Polvora', 100),
    ('Tábua Ébano', 200),
    ('Tabua Ebano', 200),
    ('Kevlar', 600),
    ('Papel', 100),
    ('Couro', 1500),
    ('Aço', 1000),
    ('Aco', 1000)
), matched AS (
  SELECT DISTINCT i.id, tp.price
  FROM public.items i
  JOIN target_prices tp
    ON lower(trim(i.name)) = lower(trim(tp.name))
  WHERE i.deleted_at IS NULL
)
UPDATE public.items i
SET purchase_price = matched.price,
    morador_purchase_price = matched.price,
    estimated_value = matched.price,
    side = CASE
      WHEN i.side = 'venda' THEN 'ambos'
      WHEN i.side IS NULL THEN 'compra'
      ELSE i.side
    END,
    updated_at = now()
FROM matched
WHERE i.id = matched.id;
