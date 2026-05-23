-- Adicionar batch_id às orders para agrupar encomendas multi-item
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS batch_id uuid;

CREATE INDEX IF NOT EXISTS idx_orders_batch_id ON public.orders(batch_id);

COMMENT ON COLUMN public.orders.batch_id IS 'Agrupa múltiplas linhas da mesma encomenda num único batch';
