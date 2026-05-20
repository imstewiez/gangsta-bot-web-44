-- 1. Alterar o constraint para incluir 'prints' como categoria válida
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_category_valid;

ALTER TABLE items ADD CONSTRAINT items_category_valid
CHECK (category = ANY (ARRAY[
  'dinheiro'::text, 'metais'::text, 'sucata_industria'::text,
  'quimicos_droga'::text, 'comida_pesca'::text, 'equipamento'::text,
  'municoes'::text, 'armas_fogo'::text, 'armas_brancas'::text,
  'armas'::text, 'acessorios'::text, 'reciclagem'::text,
  'componentes'::text, 'madeiras'::text, 'quimicos'::text,
  'electronica'::text, 'droga'::text, 'comida'::text,
  'pesca'::text, 'texteis'::text, 'utilidade'::text,
  'prints'::text, 'outros'::text
])) NOT VALID;

-- 2. Atualizar categorias dos itens para Prints
-- Print Azul: Heavy Pistol, .50, P90, Combat PDW
UPDATE items 
SET category = 'prints', subcategory = 'azul' 
WHERE deleted_at IS NULL 
  AND (name ILIKE 'Heavy Pistol%' OR name ILIKE '.50%' OR name ILIKE 'P90%' OR name ILIKE 'Combat PDW%');

-- Print Amarela: Revolver, Pistola Gadget
UPDATE items 
SET category = 'prints', subcategory = 'amarela' 
WHERE deleted_at IS NULL 
  AND (name ILIKE 'Revolver%' OR name ILIKE 'Pistola Gadget%');

-- Print Vermelha: Bullpup Rifle, Carabina Especial
UPDATE items 
SET category = 'prints', subcategory = 'vermelha' 
WHERE deleted_at IS NULL 
  AND (name ILIKE 'Bullpup Rifle%' OR name ILIKE 'Carabina Especial%');

-- 3. Verificar resultado
SELECT id, name, category, subcategory 
FROM items 
WHERE deleted_at IS NULL AND category = 'prints'
ORDER BY subcategory, name;
