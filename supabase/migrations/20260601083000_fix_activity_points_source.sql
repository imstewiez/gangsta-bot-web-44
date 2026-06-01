-- =====================================================
-- Fix activity points/stat source after bot -> webapp migration
-- =====================================================
-- Rules:
-- 1) Entregas de material generate entrega_bairrista with positive qty.
-- 2) Vendas internas generate venda_bairrista with negative qty.
-- 3) Pedido counts in stats count distinct delivery/order source ids, not movement lines.
-- 4) Activity stats are rebuilt from canonical tables, not incremented legacy counters.

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
  v_tipo text;
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

  v_tipo := CASE WHEN coalesce(v_req.tipo, 'entrega') = 'venda' THEN 'venda' ELSE 'entrega' END;

  UPDATE public.inventory_delivery_requests
  SET status = 'approved',
      decision_by = p_approved_by,
      approver_discord_id = coalesce(approver_discord_id, p_approver_discord_id),
      decided_at = now(),
      updated_at = now()
  WHERE id = p_request_id;

  FOR v_line IN SELECT * FROM jsonb_to_recordset(v_req.lines::jsonb)
    AS x(item_id integer, qty numeric)
  LOOP
    INSERT INTO public.inventory_movements
      (movement_type, item_id, quantity, member_id, location, notes, created_by, created_at)
    VALUES
      (
        CASE WHEN v_tipo = 'venda' THEN 'venda_bairrista' ELSE 'entrega_bairrista' END,
        v_line.item_id,
        CASE WHEN v_tipo = 'venda' THEN -abs(v_line.qty) ELSE abs(v_line.qty) END,
        v_req.requester_member_id,
        'armazem',
        'delivery:' || p_request_id,
        p_approved_by,
        now()
      );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.sp_rebuild_member_activity_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.all_time_stats (member_id, updated_at)
  SELECT id, now() FROM public.members
  ON CONFLICT (member_id) DO NOTHING;

  UPDATE public.all_time_stats ats
  SET
    kills_total = coalesce(k.kills, 0),
    deaths_total = coalesce(op.deaths, 0),
    saidas_total = coalesce(op.ops, 0),
    wins = coalesce(op.wins, 0),
    losses = greatest(coalesce(op.ops, 0) - coalesce(op.wins, 0), 0),
    deliveries = coalesce(del.deliveries, 0),
    sales = coalesce(sal.sales, 0),
    orders = coalesce(ord.orders, 0),
    updated_at = now()
  FROM public.members m
  LEFT JOIN (
    SELECT member_id,
           count(distinct operation_id)::int AS ops,
           coalesce(sum(case when died = true then 1 else 0 end), 0)::int AS deaths,
           coalesce(sum(case when o.was_profitable = true then 1 else 0 end), 0)::int AS wins
    FROM public.operation_participants p
    JOIN public.operations o ON o.id = p.operation_id AND o.deleted_at IS NULL
    WHERE o.status = 'concluida'
    GROUP BY member_id
  ) op ON op.member_id = m.id
  LEFT JOIN (
    SELECT member_id, coalesce(sum(kills), 0)::int AS kills
    FROM public.operation_participants
    GROUP BY member_id
  ) kop ON kop.member_id = m.id
  LEFT JOIN (
    SELECT killer_id AS member_id, count(*)::int AS kills
    FROM public.kill_logs
    WHERE killer_id IS NOT NULL
    GROUP BY killer_id
  ) klog ON klog.member_id = m.id
  LEFT JOIN LATERAL (
    SELECT coalesce(kop.kills, 0) + coalesce(klog.kills, 0) AS kills
  ) k ON true
  LEFT JOIN (
    SELECT member_id,
           count(distinct nullif(regexp_replace(coalesce(notes,''), '^delivery:', ''), ''))::int AS deliveries
    FROM public.inventory_movements
    WHERE movement_type IN ('entrega_bairrista','entrega_oficial')
      AND quantity > 0
      AND member_id IS NOT NULL
    GROUP BY member_id
  ) del ON del.member_id = m.id
  LEFT JOIN (
    SELECT member_id,
           count(distinct coalesce(
             nullif(regexp_replace(coalesce(notes,''), '^delivery:', ''), ''),
             nullif(regexp_replace(coalesce(notes,''), '^order:', ''), '')
           ))::int AS sales
    FROM public.inventory_movements
    WHERE movement_type = 'venda_bairrista'
      AND quantity < 0
      AND member_id IS NOT NULL
    GROUP BY member_id
  ) sal ON sal.member_id = m.id
  LEFT JOIN (
    SELECT member_id, count(*)::int AS orders
    FROM public.orders
    GROUP BY member_id
  ) ord ON ord.member_id = m.id
  WHERE ats.member_id = m.id;
END;
$$;

-- Historical repair: sales requests approved before this fix were stored as entrega_bairrista/positive qty.
UPDATE public.inventory_movements im
SET movement_type = 'venda_bairrista',
    quantity = -abs(im.quantity)
FROM public.inventory_delivery_requests r
WHERE im.notes = 'delivery:' || r.id::text
  AND coalesce(r.tipo, 'entrega') = 'venda'
  AND im.movement_type = 'entrega_bairrista';

SELECT public.sp_rebuild_member_activity_stats();
