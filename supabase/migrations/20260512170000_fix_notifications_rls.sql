-- Fix notifications RLS: restrict INSERT to own user only.
-- Server functions now use supabaseAdmin (service role) to insert notifications
-- for managers/other users, bypassing RLS safely.
DROP POLICY IF EXISTS "authenticated can insert notifications" ON public.notifications;

CREATE POLICY "users insert own notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
