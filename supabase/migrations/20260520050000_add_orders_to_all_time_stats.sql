-- Adicionar coluna orders à all_time_stats para suportar ajuste manual
ALTER TABLE public.all_time_stats
ADD COLUMN IF NOT EXISTS orders integer DEFAULT 0 NOT NULL;

-- Atualizar registos existentes com contagem real de orders
UPDATE public.all_time_stats s
SET orders = (SELECT count(*) FROM public.orders o WHERE o.member_id = s.member_id)
WHERE orders = 0;
