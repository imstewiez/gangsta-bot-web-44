-- Adicionar campo responsavel_id (quem deve aprovar/gerir o pedido)
-- Apenas Patrões di Zona, Kingpin ou Manda-Chuva

-- Entregas / Vendas
ALTER TABLE public.inventory_delivery_requests
ADD COLUMN IF NOT EXISTS responsavel_member_id integer REFERENCES public.members(id) ON DELETE SET NULL;

-- Encomendas
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS responsavel_member_id integer REFERENCES public.members(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.inventory_delivery_requests.responsavel_member_id IS 'Membro Patrão/Kingpin/Manda-Chuva responsável por aprovar e gerir este pedido';
COMMENT ON COLUMN public.orders.responsavel_member_id IS 'Membro Patrão/Kingpin/Manda-Chuva responsável por aprovar e gerir este pedido';
