-- Adicionar breakdown de pontuação semanal para ranking com sentido
ALTER TABLE public.weekly_rankings
ADD COLUMN IF NOT EXISTS material_points integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS sales_points integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS ops_points integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_score integer DEFAULT 0;

-- Criar índice para ordenação rápida por total_score
CREATE INDEX IF NOT EXISTS idx_weekly_rankings_total_score 
ON public.weekly_rankings(week_start DESC, total_score DESC);
