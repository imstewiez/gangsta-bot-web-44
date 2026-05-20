-- Permitir notificações por discord_id (membros sem login na web app)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS discord_id TEXT;
ALTER TABLE public.notifications ALTER COLUMN user_id DROP NOT NULL;

-- Novo index para discord_id
CREATE INDEX IF NOT EXISTS idx_notifications_discord_unread ON public.notifications(discord_id, created_at DESC) WHERE read_at IS NULL;

-- Atualizar policies para suportar discord_id
DROP POLICY IF EXISTS "users read own notifications" ON public.notifications;
CREATE POLICY "users read own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR discord_id IS NOT NULL);

DROP POLICY IF EXISTS "users update own notifications (mark read)" ON public.notifications;
CREATE POLICY "users update own notifications (mark read)"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR discord_id IS NOT NULL);
