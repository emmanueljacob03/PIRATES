-- In-app reactions while watching Pirates live (does not sync to YouTube Live Chat).
-- Run in Supabase SQL Editor after `profiles` exists.

CREATE TABLE IF NOT EXISTS public.live_stream_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) <= 500 AND char_length(trim(body)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS live_stream_chat_created_at_idx ON public.live_stream_chat (created_at DESC);

ALTER TABLE public.live_stream_chat ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.live_stream_chat TO anon;
GRANT SELECT ON public.live_stream_chat TO authenticated;
GRANT INSERT ON public.live_stream_chat TO authenticated;

DROP POLICY IF EXISTS live_stream_chat_select ON public.live_stream_chat;
CREATE POLICY live_stream_chat_select ON public.live_stream_chat FOR SELECT USING (true);

DROP POLICY IF EXISTS live_stream_chat_insert ON public.live_stream_chat;
CREATE POLICY live_stream_chat_insert ON public.live_stream_chat
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = profile_id);
