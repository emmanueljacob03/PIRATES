-- Poll votes for team chat (run after team_chat_messages exists).
-- Lets any signed-in user vote once per poll; tallies visible to all.

CREATE TABLE IF NOT EXISTS public.team_chat_poll_votes (
  message_id UUID NOT NULL REFERENCES public.team_chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_index INT NOT NULL CHECK (option_index >= 0),
  PRIMARY KEY (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS team_chat_poll_votes_message_idx ON public.team_chat_poll_votes (message_id);

ALTER TABLE public.team_chat_poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_chat_poll_votes_select" ON public.team_chat_poll_votes;
CREATE POLICY "team_chat_poll_votes_select" ON public.team_chat_poll_votes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "team_chat_poll_votes_insert" ON public.team_chat_poll_votes;
CREATE POLICY "team_chat_poll_votes_insert" ON public.team_chat_poll_votes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "team_chat_poll_votes_update" ON public.team_chat_poll_votes;
CREATE POLICY "team_chat_poll_votes_update" ON public.team_chat_poll_votes
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Optional: realtime so “who voted” updates live (Dashboard → Replication → team_chat_poll_votes)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.team_chat_poll_votes;
