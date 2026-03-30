-- Add edit/delete for own messages (run in Supabase SQL if you already applied team_chat_messages.sql without these policies).

ALTER TABLE public.team_chat_messages REPLICA IDENTITY FULL;

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
