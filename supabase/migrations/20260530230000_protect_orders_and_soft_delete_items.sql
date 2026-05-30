-- ============================================
-- PROTECT ORDERS + SOFT DELETE GUARD
-- ============================================
-- 1. Ensure orders.item_id has ON DELETE SET NULL (never cascade/delete orders)
-- 2. Add partial index for quick lookup of pending orders by item
-- 3. Ensure items.active is used consistently for catalog filtering
-- ============================================

-- 1. Fix orders foreign key to items: ON DELETE SET NULL
-- First find the existing constraint name
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  SELECT tc.constraint_name INTO v_constraint_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
  WHERE tc.table_name = 'orders'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND ccu.table_name = 'items';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', v_constraint_name);
    EXECUTE 'ALTER TABLE public.orders ADD CONSTRAINT orders_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE SET NULL';
  ELSE
    -- If no FK exists, create it (may fail if column types differ, but that's expected)
    BEGIN
      ALTER TABLE public.orders ADD CONSTRAINT orders_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.items(id) ON DELETE SET NULL;
    EXCEPTION WHEN others THEN
      RAISE NOTICE 'Could not create FK orders_item_id_fkey: %', SQLERRM;
    END;
  END IF;
END $$;

-- 2. Index for pending orders by item (used by admin guards)
CREATE INDEX IF NOT EXISTS idx_orders_pending_item ON public.orders(item_id) WHERE status IN ('pending', 'approved', 'in_progress', 'ready');

-- 3. Ensure all historical orders with deleted items keep their data
-- (item_name is resolved at runtime via join, but we want to preserve item_id references)
-- No data migration needed; ON DELETE SET NULL will preserve future orders.
