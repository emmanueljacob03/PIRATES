-- Team chat (run in Supabase SQL Editor). Enables WhatsApp-style group chat + admin alerts.

CREATE TABLE IF NOT EXISTS public.team_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  body TEXT NOT NULL CHECK (char_length(trim(body)) > 0 AND char_length(body) <= 4000),
  is_alert BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS team_chat_messages_created_at_idx ON public.team_chat_messages (created_at);

-- Helps realtime broadcast full row on UPDATE/DELETE for other clients
ALTER TABLE public.team_chat_messages REPLICA IDENTITY FULL;

ALTER TABLE public.team_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_chat_read" ON public.team_chat_messages;
CREATE POLICY "team_chat_read" ON public.team_chat_messages
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "team_chat_insert" ON public.team_chat_messages;
CREATE POLICY "team_chat_insert" ON public.team_chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      is_alert = FALSE
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  );

DROP POLICY IF EXISTS "team_chat_update" ON public.team_chat_messages;
CREATE POLICY "team_chat_update" ON public.team_chat_messages
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND char_length(trim(body)) > 0
    AND char_length(body) <= 4000
    AND (
      is_alert = FALSE
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  );

DROP POLICY IF EXISTS "team_chat_delete" ON public.team_chat_messages;
CREATE POLICY "team_chat_delete" ON public.team_chat_messages
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Alert messages: POST /api/team-chat with is_alert uses the service role (see app code) so team-code
-- admins (cookie) still work; set SUPABASE_SERVICE_ROLE_KEY in env. Normal messages use the user client + RLS.

-- Realtime: Dashboard → Database → Replication → enable for team_chat_messages
-- Or (if your project allows):
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.team_chat_messages;
