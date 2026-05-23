-- Fix historic inventory_movements linked to web deliveries where member_id is null.
-- Joins with inventory_delivery_requests to recover the correct requester_member_id.
UPDATE public.inventory_movements im
SET member_id = r.requester_member_id
FROM public.inventory_delivery_requests r
WHERE im.notes LIKE 'delivery:%'
  AND r.id = substring(im.notes FROM 10)::uuid
  AND im.member_id IS NULL
  AND r.requester_member_id IS NOT NULL;
