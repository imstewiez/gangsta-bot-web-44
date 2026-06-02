-- Permite definir preços finais por cargo para os dois modos de encomenda:
-- - price_with_material: preço final quando o bairrista entrega materiais + dinheiro
-- - price_without_material: preço final quando o bairrista paga apenas dinheiro
-- Mantém a coluna legacy surcharge para compatibilidade com dados antigos.

ALTER TABLE public.item_tier_surcharges
  ADD COLUMN IF NOT EXISTS price_with_material numeric,
  ADD COLUMN IF NOT EXISTS price_without_material numeric;

UPDATE public.item_tier_surcharges its
SET price_with_material = i.min_sale_price + its.surcharge
FROM public.items i
WHERE i.id = its.item_id
  AND its.price_with_material IS NULL
  AND its.surcharge IS NOT NULL
  AND its.surcharge <> 0
  AND i.min_sale_price IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_item_tier_surcharges_item_tier
  ON public.item_tier_surcharges(item_id, tier);
