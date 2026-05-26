-- Auto-recalculate all_time_stats when source tables change
-- These triggers keep derived data consistent automatically

-- 1. When kill_logs changes
CREATE OR REPLACE FUNCTION public.tg_recalc_member_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  member_id_var int;
BEGIN
  -- Determine affected member
  IF TG_OP = 'DELETE' THEN
    member_id_var := OLD.killer_id;
  ELSE
    member_id_var := NEW.killer_id;
  END IF;

  IF member_id_var IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Recalculate stats for this member
  INSERT INTO public.all_time_stats (member_id, kills_total, updated_at)
  SELECT
    member_id_var,
    COALESCE((SELECT COUNT(*) FROM public.kill_logs WHERE killer_id = member_id_var), 0) +
    COALESCE((SELECT SUM(kills) FROM public.operation_participants p JOIN public.operations o ON o.id = p.operation_id WHERE o.status = 'concluida' AND p.member_id = member_id_var), 0),
    NOW()
  ON CONFLICT (member_id) DO UPDATE SET
    kills_total = EXCLUDED.kills_total,
    total_score = EXCLUDED.kills_total * 3 + public.all_time_stats.deliveries * 2 + public.all_time_stats.sales * 2 + public.all_time_stats.saidas_total * 2 + public.all_time_stats.wins * 4 - public.all_time_stats.deaths_total,
    updated_at = NOW();

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS kill_logs_recalc ON public.kill_logs;
CREATE TRIGGER kill_logs_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.kill_logs
FOR EACH ROW EXECUTE FUNCTION public.tg_recalc_member_stats();

-- 2. When operation_participants changes (deaths, kills, saidas)
CREATE OR REPLACE FUNCTION public.tg_recalc_member_ops()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  member_id_var int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    member_id_var := OLD.member_id;
  ELSE
    member_id_var := NEW.member_id;
  END IF;

  IF member_id_var IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.all_time_stats (member_id, deaths_total, saidas_total, wins, losses, updated_at)
  SELECT
    member_id_var,
    COALESCE((SELECT COUNT(*) FROM public.operation_participants p JOIN public.operations o ON o.id = p.operation_id WHERE o.status = 'concluida' AND p.died = true AND p.member_id = member_id_var), 0),
    COALESCE((SELECT COUNT(*) FROM public.operation_participants p JOIN public.operations o ON o.id = p.operation_id WHERE o.status = 'concluida' AND p.member_id = member_id_var), 0),
    COALESCE((SELECT COUNT(*) FROM public.operation_participants p JOIN public.operations o ON o.id = p.operation_id WHERE o.status = 'concluida' AND o.was_profitable = true AND p.member_id = member_id_var), 0),
    COALESCE((SELECT COUNT(*) FROM public.operation_participants p JOIN public.operations o ON o.id = p.operation_id WHERE o.status = 'concluida' AND (o.was_profitable = false OR o.was_profitable IS NULL) AND p.member_id = member_id_var), 0),
    NOW()
  ON CONFLICT (member_id) DO UPDATE SET
    deaths_total = EXCLUDED.deaths_total,
    saidas_total = EXCLUDED.saidas_total,
    wins = EXCLUDED.wins,
    losses = EXCLUDED.losses,
    total_score = public.all_time_stats.kills_total * 3 + public.all_time_stats.deliveries * 2 + public.all_time_stats.sales * 2 + EXCLUDED.saidas_total * 2 + EXCLUDED.wins * 4 - EXCLUDED.deaths_total,
    updated_at = NOW();

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS ops_recalc ON public.operation_participants;
CREATE TRIGGER ops_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.operation_participants
FOR EACH ROW EXECUTE FUNCTION public.tg_recalc_member_ops();

-- 3. When inventory_movements changes (deliveries, sales)
CREATE OR REPLACE FUNCTION public.tg_recalc_member_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  member_id_var int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    member_id_var := OLD.member_id;
  ELSE
    member_id_var := NEW.member_id;
  END IF;

  IF member_id_var IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.all_time_stats (member_id, deliveries, sales, updated_at)
  SELECT
    member_id_var,
    COALESCE((SELECT COUNT(*) FROM public.inventory_movements WHERE member_id = member_id_var AND movement_type IN ('entrega_bairrista', 'entrega_oficial')), 0),
    COALESCE((SELECT COUNT(*) FROM public.inventory_movements WHERE member_id = member_id_var AND movement_type = 'venda_bairrista'), 0),
    NOW()
  ON CONFLICT (member_id) DO UPDATE SET
    deliveries = EXCLUDED.deliveries,
    sales = EXCLUDED.sales,
    total_score = public.all_time_stats.kills_total * 3 + EXCLUDED.deliveries * 2 + EXCLUDED.sales * 2 + public.all_time_stats.saidas_total * 2 + public.all_time_stats.wins * 4 - public.all_time_stats.deaths_total,
    updated_at = NOW();

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS inventory_recalc ON public.inventory_movements;
CREATE TRIGGER inventory_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.inventory_movements
FOR EACH ROW EXECUTE FUNCTION public.tg_recalc_member_inventory();

-- 4. When orders change
CREATE OR REPLACE FUNCTION public.tg_recalc_member_orders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  member_id_var int;
BEGIN
  IF TG_OP = 'DELETE' THEN
    member_id_var := OLD.member_id;
  ELSE
    member_id_var := NEW.member_id;
  END IF;

  IF member_id_var IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.all_time_stats (member_id, orders, updated_at)
  SELECT
    member_id_var,
    COALESCE((SELECT COUNT(*) FROM public.orders WHERE member_id = member_id_var), 0),
    NOW()
  ON CONFLICT (member_id) DO UPDATE SET
    orders = EXCLUDED.orders,
    total_score = public.all_time_stats.kills_total * 3 + public.all_time_stats.deliveries * 2 + public.all_time_stats.sales * 2 + public.all_time_stats.saidas_total * 2 + public.all_time_stats.wins * 4 - public.all_time_stats.deaths_total,
    updated_at = NOW();

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS orders_recalc ON public.orders;
CREATE TRIGGER orders_recalc
AFTER INSERT OR UPDATE OR DELETE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.tg_recalc_member_orders();
