-- Permite quantidades diferentes de materiais por cargo/tier nas receitas.
-- Ex.: um item pode pedir 10 peças por defeito, mas 8 para Bairrista-2 e 6 para Bairrista-3.
-- A quantidade base continua em recipe_ingredients.quantity.

CREATE TABLE IF NOT EXISTS public.recipe_ingredient_tier_overrides (
  id bigserial PRIMARY KEY,
  recipe_id integer NOT NULL REFERENCES public.craft_recipes(id) ON DELETE CASCADE,
  ingredient_item_id integer NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  tier text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS recipe_ingredient_tier_overrides_unique
  ON public.recipe_ingredient_tier_overrides(recipe_id, ingredient_item_id, tier);

CREATE INDEX IF NOT EXISTS idx_recipe_ingredient_tier_overrides_recipe
  ON public.recipe_ingredient_tier_overrides(recipe_id);
