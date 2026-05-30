-- Nova tabela para acrescidos por item e tier de morador
CREATE TABLE IF NOT EXISTS item_tier_surcharges (
  id SERIAL PRIMARY KEY,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  tier VARCHAR NOT NULL,
  surcharge INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(item_id, tier)
);

-- Index para lookup rápido por item
CREATE INDEX IF NOT EXISTS idx_item_tier_surcharges_item ON item_tier_surcharges(item_id);

-- RLS
ALTER TABLE item_tier_surcharges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON item_tier_surcharges
  FOR ALL USING (true) WITH CHECK (true);
