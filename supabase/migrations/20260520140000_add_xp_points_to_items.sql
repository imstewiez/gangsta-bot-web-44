-- Adicionar coluna xp_points à tabela items para pontos por entrega
ALTER TABLE public.items
ADD COLUMN IF NOT EXISTS xp_points integer DEFAULT 1;

-- Atualizar items existentes com base no mapeamento conhecido
UPDATE public.items
SET xp_points = CASE
  WHEN lower(name) IN ('print', 'prints', 'peças', 'pecas', 'molde de arma', 'moldes', 'corpo', 'corpos') THEN 4
  WHEN lower(name) IN ('cobre', 'serradura', 'pólvora', 'polvora', 'peças estragadas', 'pecas estragadas') THEN 3
  WHEN lower(name) IN ('lixo eletrónico', 'lixo eletronico', 'sucata', 'plástico reciclado', 'plastico reciclado', 'telemóvel estragado', 'telemovel estragado', 'rádio estragado', 'radio estragado', 'plástico velho', 'plastico velho') THEN 2
  ELSE 1
END;
