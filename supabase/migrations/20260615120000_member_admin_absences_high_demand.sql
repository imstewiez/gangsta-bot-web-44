-- Member admin tools: notes, disciplinary records, absences, high-demand materials,
-- and per-item control over what the organization buys.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.member_notes (
  id bigserial PRIMARY KEY,
  member_id integer NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_member_id integer REFERENCES public.members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_member_notes_member_created
  ON public.member_notes(member_id, created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.member_notes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.member_disciplinary_records (
  id bigserial PRIMARY KEY,
  member_id integer NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text,
  body text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  resolved_at timestamptz,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_member_id integer REFERENCES public.members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  deleted_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_member_disciplinary_member_issued
  ON public.member_disciplinary_records(member_id, issued_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_member_disciplinary_open
  ON public.member_disciplinary_records(member_id, kind)
  WHERE deleted_at IS NULL AND resolved_at IS NULL;

ALTER TABLE public.member_disciplinary_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'member_disciplinary_kind_check'
  ) THEN
    ALTER TABLE public.member_disciplinary_records
      ADD CONSTRAINT member_disciplinary_kind_check
      CHECK (kind IN ('aviso', 'punicao'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.member_absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id integer NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  reason text,
  ended_at timestamptz,
  created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_member_id integer REFERENCES public.members(id) ON DELETE SET NULL,
  ended_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.member_absences
  ADD COLUMN IF NOT EXISTS starts_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_member_id integer REFERENCES public.members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ended_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_member_absences_member_active
  ON public.member_absences(member_id, starts_at DESC)
  WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_member_absences_expiring
  ON public.member_absences(ends_at)
  WHERE ended_at IS NULL AND ends_at IS NOT NULL;

ALTER TABLE public.member_absences ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS org_buy_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS high_demand boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS high_demand_points integer,
  ADD COLUMN IF NOT EXISTS high_demand_reason text,
  ADD COLUMN IF NOT EXISTS high_demand_until timestamptz,
  ADD COLUMN IF NOT EXISTS high_demand_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_items_org_buy_enabled
  ON public.items(org_buy_enabled)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_items_high_demand
  ON public.items(high_demand, high_demand_until)
  WHERE deleted_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'items_high_demand_points_check'
  ) THEN
    ALTER TABLE public.items
      ADD CONSTRAINT items_high_demand_points_check
      CHECK (high_demand_points IS NULL OR high_demand_points >= 0);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.expire_member_absences()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH expired AS (
    UPDATE public.member_absences a
       SET ended_at = COALESCE(a.ended_at, now()),
           updated_at = now()
     WHERE a.ended_at IS NULL
       AND a.ends_at IS NOT NULL
       AND a.ends_at <= now()
     RETURNING a.member_id
  ),
  restored AS (
    UPDATE public.members m
       SET status = 'ativo',
           lifecycle_state = 'active',
           lifecycle_changed_at = now(),
           lifecycle_changed_by = 'system:absence-expired',
           lifecycle_notes = 'Ausencia terminada automaticamente',
           updated_at = now()
      FROM expired e
     WHERE m.id = e.member_id
       AND m.deleted_at IS NULL
       AND COALESCE(m.lifecycle_state::text, m.status, 'active') IN ('absent', 'ausente')
     RETURNING m.id
  )
  SELECT count(*) INTO v_count FROM restored;

  RETURN v_count;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.member_notes;
EXCEPTION WHEN duplicate_object OR undefined_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.member_disciplinary_records;
EXCEPTION WHEN duplicate_object OR undefined_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.member_absences;
EXCEPTION WHEN duplicate_object OR undefined_object THEN
  NULL;
END $$;
