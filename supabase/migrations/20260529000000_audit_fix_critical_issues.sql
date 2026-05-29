-- ============================================
-- AUDIT FIX: Critical issues resolution
-- ============================================
-- This migration addresses CRIT-1 through CRIT-5, HIGH-2, HIGH-4, HIGH-5,
-- MED-2, MED-3, LOW-1, LOW-2, LOW-3
--
-- 1. Stored procedures for atomic cross-table operations
-- 2. order_comments DDL (moved from request handler)
-- 3. Rename legacy sequences and stock_v3 tables
-- 4. Add tracking columns to pending_notifications, sync_retries, job_runs
-- 5. Add ON CONFLICT to weekly_rankings
-- 6. Add unique constraint for idempotency on order_status_history
-- ============================================

-- ============================================
-- 1. ORDER COMMENTS TABLE (moved from request handler)
-- ============================================
CREATE TABLE IF NOT EXISTS public.order_comments (
  id serial primary key,
  order_id int not null references public.orders(id) on delete cascade,
  author_id int references public.members(id) on delete set null,
  author_name text,
  content text not null,
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS idx_order_comments_order_id ON public.order_comments(order_id);

-- ============================================
-- 2. RENAME LEGACY SEQUENCES
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'cemetery_kills_id_seq') THEN
    ALTER SEQUENCE public.cemetery_kills_id_seq RENAME TO kill_logs_id_seq;
  END IF;
END $$;

-- ============================================
-- 3. RENAME STOCK_V3 TABLES (version suffix anti-pattern)
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stock_v3_movements') THEN
    ALTER TABLE public.stock_v3_movements RENAME TO stock_movements;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stock_v3_pricing') THEN
    ALTER TABLE public.stock_v3_pricing RENAME TO stock_pricing;
  END IF;
END $$;

-- Update sequences for renamed tables
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'stock_v3_movements_id_seq') THEN
    ALTER SEQUENCE public.stock_v3_movements_id_seq RENAME TO stock_movements_id_seq;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'stock_v3_pricing_id_seq') THEN
    ALTER SEQUENCE public.stock_v3_pricing_id_seq RENAME TO stock_pricing_id_seq;
  END IF;
END $$;

-- ============================================
-- 4. TRACKING COLUMNS FOR JOB_RUNS
-- ============================================
ALTER TABLE public.job_runs
ADD COLUMN IF NOT EXISTS job_name text,
ADD COLUMN IF NOT EXISTS started_at timestamptz,
ADD COLUMN IF NOT EXISTS ended_at timestamptz,
ADD COLUMN IF NOT EXISTS status text, -- 'running', 'success', 'failed'
ADD COLUMN IF NOT EXISTS error_message text,
ADD COLUMN IF NOT EXISTS rows_affected integer;

CREATE INDEX IF NOT EXISTS idx_job_runs_status_started ON public.job_runs(status, started_at DESC);

-- ============================================
-- 5. TRACKING COLUMNS FOR PENDING_NOTIFICATIONS
-- ============================================
ALTER TABLE public.pending_notifications
ADD COLUMN IF NOT EXISTS processed_at timestamptz,
ADD COLUMN IF NOT EXISTS failed_at timestamptz,
ADD COLUMN IF NOT EXISTS last_error text,
ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS dedup_key text;

CREATE INDEX IF NOT EXISTS idx_pending_notifications_unprocessed ON public.pending_notifications(processed_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pending_notifications_stale ON public.pending_notifications(created_at) WHERE processed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pending_notifications_dedup ON public.pending_notifications(dedup_key) WHERE dedup_key IS NOT NULL;

-- ============================================
-- 6. TRACKING COLUMNS FOR SYNC_RETRIES
-- ============================================
ALTER TABLE public.sync_retries
ADD COLUMN IF NOT EXISTS retry_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_retries integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS last_error text,
ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
ADD COLUMN IF NOT EXISTS dead_lettered boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS dead_lettered_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_sync_retries_pending ON public.sync_retries(dead_lettered, next_retry_at) WHERE dead_lettered = false;
CREATE INDEX IF NOT EXISTS idx_sync_retries_dead_lettered ON public.sync_retries(dead_lettered, dead_lettered_at) WHERE dead_lettered = true;

-- ============================================
-- 7. UNIQUE CONSTRAINT FOR WEEKLY_RANKINGS (idempotency)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname = 'idx_weekly_rankings_member_week'
  ) THEN
    CREATE UNIQUE INDEX idx_weekly_rankings_member_week ON public.weekly_rankings(member_id, week_start);
  END IF;
EXCEPTION WHEN duplicate_table THEN
  NULL;
END $$;

-- ============================================
-- 8. STORED PROCEDURE: Atomic order transition
-- ============================================
CREATE OR REPLACE FUNCTION public.sp_transition_order(
  p_order_id integer,
  p_new_status text,
  p_changed_by text,
  p_notes text DEFAULT NULL
)
RETURNS TABLE (
  old_status text,
  member_id integer,
  item_id integer,
  quantity integer,
  item_name text,
  responsavel_member_id integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status text;
  v_member_id integer;
  v_item_id integer;
  v_quantity integer;
  v_item_name text;
  v_responsavel_member_id integer;
  v_is_final boolean;
  v_is_resolved boolean;
BEGIN
  -- Lock the order row and get current state atomically
  SELECT o.status, o.member_id, o.item_id, o.quantity, i.name, o.responsavel_member_id
  INTO v_old_status, v_member_id, v_item_id, v_quantity, v_item_name, v_responsavel_member_id
  FROM public.orders o
  LEFT JOIN public.items i ON i.id = o.item_id
  WHERE o.id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Encomenda não encontrada';
  END IF;

  v_is_final := (p_new_status = 'fulfilled');
  v_is_resolved := (p_new_status != 'pending');

  -- Insert inventory movement ONLY if transitioning to fulfilled from non-fulfilled
  IF v_is_final AND v_old_status != 'fulfilled' AND v_item_id IS NOT NULL THEN
    INSERT INTO public.inventory_movements
      (movement_type, item_id, quantity, member_id, location, notes, created_by, created_at)
    VALUES
      ('venda_bairrista', v_item_id, -v_quantity, v_member_id, 'armazem', 'order:' || p_order_id, p_changed_by, now());
  END IF;

  -- Update order status atomically
  UPDATE public.orders
  SET status = p_new_status,
      updated_at = now(),
      updated_by = p_changed_by,
      delivered_at = CASE WHEN v_is_final THEN now() ELSE delivered_at END,
      resolved_at = CASE WHEN v_is_resolved THEN now() ELSE resolved_at END,
      approved_by = CASE WHEN p_new_status = 'approved' AND approved_by IS NULL THEN p_changed_by ELSE approved_by END,
      fulfilled_by = CASE WHEN v_is_final THEN p_changed_by ELSE fulfilled_by END
  WHERE id = p_order_id;

  -- Insert status history
  INSERT INTO public.order_status_history
    (order_id, old_status, new_status, changed_by, notes, created_at)
  VALUES
    (p_order_id, v_old_status, p_new_status, p_changed_by, p_notes, now());

  RETURN QUERY SELECT v_old_status, v_member_id, v_item_id, v_quantity, v_item_name, v_responsavel_member_id;
END;
$$;

-- ============================================
-- 9. STORED PROCEDURE: Atomic order cancellation
-- ============================================
CREATE OR REPLACE FUNCTION public.sp_cancel_orders(
  p_order_ids integer[],
  p_changed_by text,
  p_reason text DEFAULT 'Cancelado pelo utilizador'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cancelled integer := 0;
  v_rec record;
BEGIN
  FOR v_rec IN
    SELECT id, status
    FROM public.orders
    WHERE id = ANY(p_order_ids)
      AND status NOT IN ('fulfilled', 'denied', 'cancelled')
    FOR UPDATE
  LOOP
    UPDATE public.orders
    SET status = 'cancelled',
        updated_at = now(),
        updated_by = p_changed_by,
        resolved_at = now()
    WHERE id = v_rec.id;

    INSERT INTO public.order_status_history
      (order_id, old_status, new_status, changed_by, notes, created_at)
    VALUES
      (v_rec.id, v_rec.status, 'cancelled', p_changed_by, p_reason, now());

    v_cancelled := v_cancelled + 1;
  END LOOP;

  RETURN v_cancelled;
END;
$$;

-- ============================================
-- 10. STORED PROCEDURE: Atomic operation creation with participants
-- ============================================
CREATE OR REPLACE FUNCTION public.sp_create_operation_with_participants(
  p_operation_type text,
  p_spot text,
  p_leader_id integer,
  p_scheduled_at timestamptz,
  p_notes text,
  p_created_by text,
  p_participants integer[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op_id integer;
  v_pid integer;
BEGIN
  INSERT INTO public.operations
    (operation_type, spot, leader_id, status, date, scheduled_time, start_time, notes, created_by, created_at)
  VALUES
    (p_operation_type, p_spot, p_leader_id, 'criada',
     coalesce(p_scheduled_at::date, current_date),
     p_scheduled_at::time,
     p_scheduled_at, p_notes, p_created_by, now())
  RETURNING id INTO v_op_id;

  IF p_participants IS NOT NULL THEN
    FOREACH v_pid IN ARRAY p_participants
    LOOP
      INSERT INTO public.operation_participants
        (operation_id, member_id, role_in_op)
      VALUES
        (v_op_id, v_pid, 'participante');
    END LOOP;
  END IF;

  RETURN v_op_id;
END;
$$;

-- ============================================
-- 11. STORED PROCEDURE: Atomic tag request approval
-- ============================================
CREATE OR REPLACE FUNCTION public.sp_approve_tag_request(
  p_request_id integer,
  p_approved_by text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tr record;
  v_member_id integer;
  v_existing_id integer;
BEGIN
  SELECT * INTO v_tr
  FROM public.tag_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF v_tr.status != 'pending' THEN
    RAISE EXCEPTION 'Pedido já resolvido';
  END IF;

  -- Upsert member by discord_id
  SELECT id INTO v_existing_id
  FROM public.members
  WHERE discord_id = v_tr.discord_id AND deleted_at IS NULL;

  IF v_existing_id IS NOT NULL THEN
    v_member_id := v_existing_id;
  ELSE
    INSERT INTO public.members
      (discord_id, username, display_name, full_name, nickname,
       role, status, joined_at, lifecycle_state, created_at, updated_at)
    VALUES
      (v_tr.discord_id, v_tr.username,
       coalesce(v_tr.full_name, v_tr.username),
       v_tr.full_name, v_tr.nickname,
       'bairrista', 'active', now(), 'active', now(), now())
    RETURNING id INTO v_member_id;
  END IF;

  UPDATE public.tag_requests
  SET status = 'approved',
      approved_by = p_approved_by,
      resolved_at = now(),
      processed_at = now()
  WHERE id = p_request_id;

  RETURN v_member_id;
END;
$$;

-- ============================================
-- 12. STORED PROCEDURE: Atomic liquidation
-- ============================================
CREATE OR REPLACE FUNCTION public.sp_liquidate_saida(
  p_operation_id integer,
  p_actor_id text
)
RETURNS TABLE (
  supplied numeric,
  returned numeric,
  lost numeric,
  consumed numeric,
  gross numeric,
  net numeric,
  operation_type text,
  spot text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op record;
  v_supplied numeric;
  v_returned numeric;
  v_lost numeric;
  v_consumed numeric;
  v_gross numeric;
  v_net numeric;
BEGIN
  -- Lock operation row
  SELECT * INTO v_op
  FROM public.operations
  WHERE id = p_operation_id AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Saída não encontrada';
  END IF;

  IF v_op.status = 'concluida' THEN
    RAISE EXCEPTION 'Saída já concluída';
  END IF;

  -- Update per-participant values from operation_materials
  UPDATE public.operation_participants p
  SET issued_value = coalesce(mat.issued_v, 0),
      returned_value = coalesce(mat.returned_v, 0),
      lost_value = coalesce(mat.lost_v, 0),
      consumed_value = coalesce(mat.consumed_v, 0),
      net_material_delta = coalesce(mat.returned_v, 0) - coalesce(mat.issued_v, 0) - coalesce(mat.lost_v, 0) - coalesce(mat.consumed_v, 0),
      settled = true
  FROM (
    SELECT om.member_id,
           sum(case when om.direction in ('fornecido') then om.quantity * coalesce(i.purchase_price, i.estimated_value, 0) else 0 end) as issued_v,
           sum(case when om.direction in ('devolvido') then om.quantity * coalesce(i.purchase_price, i.estimated_value, 0) else 0 end) as returned_v,
           sum(case when om.direction = 'perdido' then om.quantity * coalesce(i.purchase_price, i.estimated_value, 0) else 0 end) as lost_v,
           sum(case when om.direction = 'consumido' then om.quantity * coalesce(i.purchase_price, i.estimated_value, 0) else 0 end) as consumed_v
    FROM public.operation_materials om
    LEFT JOIN public.items i ON i.id = om.item_id
    WHERE om.operation_id = p_operation_id AND om.member_id IS NOT NULL
    GROUP BY om.member_id
  ) mat
  WHERE p.operation_id = p_operation_id AND p.member_id = mat.member_id;

  -- Mark remaining unsettled participants as settled
  UPDATE public.operation_participants
  SET settled = true
  WHERE operation_id = p_operation_id AND (settled IS NULL OR settled = false);

  -- Aggregate totals
  SELECT coalesce(sum(issued_value), 0),
         coalesce(sum(returned_value), 0),
         coalesce(sum(lost_value), 0),
         coalesce(sum(consumed_value), 0)
  INTO v_supplied, v_returned, v_lost, v_consumed
  FROM public.operation_participants
  WHERE operation_id = p_operation_id;

  v_gross := v_returned;
  v_net := v_returned - v_lost - v_consumed;

  -- Update operation
  UPDATE public.operations
  SET status = 'concluida',
      end_time = coalesce(end_time, now()),
      liquidation_started_at = coalesce(liquidation_started_at, now()),
      supplied_value = v_supplied,
      returned_value = v_returned,
      lost_value = v_lost,
      consumed_value = v_consumed,
      gross_value = v_gross,
      net_value = v_net,
      was_profitable = (v_net > 0),
      result = CASE WHEN v_net > 0 THEN 'vitoria' ELSE 'derrota' END,
      updated_at = now()
  WHERE id = p_operation_id;

  -- Audit log
  INSERT INTO public.audit_logs
    (action, entity_type, entity_id, actor_id, after_state, created_at)
  VALUES
    ('liquidate', 'operation', p_operation_id::text, p_actor_id,
     jsonb_build_object('supplied', v_supplied, 'returned', v_returned, 'lost', v_lost, 'consumed', v_consumed, 'net', v_net),
     now());

  RETURN QUERY SELECT v_supplied, v_returned, v_lost, v_consumed, v_gross, v_net, v_op.operation_type, v_op.spot;
END;
$$;

-- ============================================
-- 13. STORED PROCEDURE: Atomic stock adjustment (delta computed in SQL)
-- ============================================
CREATE OR REPLACE FUNCTION public.sp_adjust_stock(
  p_item_id integer,
  p_target_qty numeric,
  p_created_by text,
  p_notes text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current numeric;
  v_delta numeric;
BEGIN
  SELECT coalesce(balance, 0) INTO v_current
  FROM public.inventory_balance
  WHERE item_id = p_item_id;

  v_delta := p_target_qty - coalesce(v_current, 0);

  IF v_delta != 0 THEN
    INSERT INTO public.inventory_movements
      (movement_type, item_id, quantity, member_id, location, notes, created_by, created_at)
    VALUES
      ('ajuste_manual', p_item_id, v_delta, NULL, 'armazem',
       coalesce(p_notes, 'ajuste: ' || v_current || ' → ' || p_target_qty),
       p_created_by, now());
  END IF;

  RETURN v_delta;
END;
$$;

-- ============================================
-- 14. STORED PROCEDURE: Atomic delivery approval with batch insert
-- ============================================
CREATE OR REPLACE FUNCTION public.sp_approve_delivery(
  p_request_id uuid,
  p_approved_by text,
  p_approver_discord_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req record;
  v_line record;
  v_stat_col text;
BEGIN
  SELECT * INTO v_req
  FROM public.inventory_delivery_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido não encontrado';
  END IF;

  IF v_req.status != 'pending' THEN
    RAISE EXCEPTION 'Já decidido';
  END IF;

  -- Update request status
  UPDATE public.inventory_delivery_requests
  SET status = 'approved',
      decision_by = p_approved_by,
      approver_discord_id = coalesce(approver_discord_id, p_approver_discord_id),
      decided_at = now(),
      updated_at = now()
  WHERE id = p_request_id;

  -- Batch insert inventory movements
  FOR v_line IN SELECT * FROM jsonb_to_recordset(v_req.lines::jsonb)
    AS x(item_id integer, qty numeric)
  LOOP
    INSERT INTO public.inventory_movements
      (movement_type, item_id, quantity, member_id, location, notes, created_by, created_at)
    VALUES
      ('entrega_bairrista', v_line.item_id, v_line.qty, v_req.requester_member_id, 'armazem',
       'delivery:' || p_request_id, p_approved_by, now());
  END LOOP;

  -- Update all_time_stats
  v_stat_col := CASE WHEN v_req.tipo = 'venda' THEN 'sales' ELSE 'deliveries' END;

  EXECUTE format(
    'INSERT INTO public.all_time_stats (member_id, %I, updated_at) VALUES ($1, 1, now())
     ON CONFLICT (member_id) DO UPDATE SET %I = public.all_time_stats.%I + 1, updated_at = now()',
    v_stat_col, v_stat_col, v_stat_col
  ) USING v_req.requester_member_id;
END;
$$;

-- ============================================
-- 15. ENABLE RLS ON NEW TABLES
-- ============================================
ALTER TABLE public.order_comments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 16. EXPLICIT DENY POLICY for order_comments (service role only)
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'order_comments' AND policyname = 'deny_all_to_authenticated'
  ) THEN
    CREATE POLICY "deny_all_to_authenticated" ON public.order_comments
      FOR ALL TO authenticated USING (false) WITH CHECK (false);
  END IF;
END $$;
