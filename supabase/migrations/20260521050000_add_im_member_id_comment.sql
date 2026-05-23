-- Reminder that inventory_movements.member_id should not be null for delivery/sales movements.
COMMENT ON COLUMN public.inventory_movements.member_id IS 'Member who made the movement. Must NOT be null for entrega_bairrista / venda_bairrista movements linked to a delivery request.';
