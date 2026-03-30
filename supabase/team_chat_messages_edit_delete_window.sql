-- Apply if you already created team_chat: viewer edit/delete own only within 20 minutes;
-- profile role=admin can edit/delete any message anytime. (Cookie-only admins use /api/team-chat PATCH/DELETE + service role.)

DROP POLICY IF EXISTS "team_chat_update" ON public.team_chat_messages;
CREATE POLICY "team_chat_update" ON public.team_chat_messages
  FOR UPDATE TO authenticated
  USING (
    (
      user_id = auth.uid()
      AND created_at > NOW() - INTERVAL '20 minutes'
    )
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    char_length(trim(body)) > 0
    AND char_length(body) <= 4000
    AND (
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
      OR (user_id = auth.uid() AND is_alert = FALSE)
    )
  );

DROP POLICY IF EXISTS "team_chat_delete" ON public.team_chat_messages;
CREATE POLICY "team_chat_delete" ON public.team_chat_messages
  FOR DELETE TO authenticated
  USING (
    (
      user_id = auth.uid()
      AND created_at > NOW() - INTERVAL '20 minutes'
    )
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
