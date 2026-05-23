-- Consolidado: todas as colunas e alterações em falta desde 2026-05-20
-- Correr isto no Supabase SQL Editor se as migrations individuais não foram aplicadas

-- 1. Responsável em pedidos de entrega e encomendas (2026-05-20)
ALTER TABLE public.inventory_delivery_requests
ADD COLUMN IF NOT EXISTS responsavel_member_id integer REFERENCES public.members(id) ON DELETE SET NULL;

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS responsavel_member_id integer REFERENCES public.members(id) ON DELETE SET NULL;

-- 2. Orders em all_time_stats (2026-05-20)
ALTER TABLE public.all_time_stats
ADD COLUMN IF NOT EXISTS orders integer DEFAULT 0 NOT NULL;

-- 3. batch_id em orders (2026-05-21)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS batch_id uuid;

CREATE INDEX IF NOT EXISTS idx_orders_batch_id ON public.orders(batch_id);

-- 4. dirty_money em orders (2026-05-21)
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS dirty_money numeric(12,2);

-- 5. xp_points em items (2026-05-20)
ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS xp_points integer DEFAULT 1;

-- 6. weekly_rankings breakdown (2026-05-21)
ALTER TABLE public.weekly_rankings
ADD COLUMN IF NOT EXISTS material_points integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS sales_points integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS ops_points integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_score integer DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_weekly_rankings_total_score 
ON public.weekly_rankings(week_start DESC, total_score DESC);

-- Atualizar orders_total em all_time_stats
UPDATE public.all_time_stats s
SET orders = COALESCE((SELECT count(*) FROM public.orders o WHERE o.member_id = s.member_id), 0)
WHERE orders = 0;
