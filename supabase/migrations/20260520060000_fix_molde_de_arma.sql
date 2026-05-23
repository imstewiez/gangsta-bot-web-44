-- Corrigir Molde de Arma para aparecer no preçário de compra
UPDATE public.items
SET side = 'compra',
    subcategory = 'materiais_craft',
    purchase_price = 10000,
    updated_at = now()
WHERE id = 69;
