-- Adicionar 'superadmin' ao enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'superadmin';

-- Sincronizar user_roles: garantir que todos os manda-chuva têm superadmin
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'superadmin'::public.app_role
FROM public.profiles p
JOIN public.members m ON m.discord_id = p.discord_id
WHERE m.deleted_at IS NULL
  AND (m.tier = 'manda_chuva' OR m.role = 'manda_chuva')
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.user_id AND ur.role = 'superadmin'
  )
ON CONFLICT (user_id, role) DO NOTHING;

-- Sincronizar user_roles: garantir que todos os kingpin/chefia têm admin
INSERT INTO public.user_roles (user_id, role)
SELECT p.user_id, 'admin'::public.app_role
FROM public.profiles p
JOIN public.members m ON m.discord_id = p.discord_id
WHERE m.deleted_at IS NULL
  AND (m.tier = 'kingpin' OR m.role = 'kingpin' OR m.role = 'chefia')
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.user_id AND ur.role = 'admin'
  )
ON CONFLICT (user_id, role) DO NOTHING;
