-- Save completed live streams so users can reopen old links.
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.live_stream_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  label TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.live_stream_history ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.live_stream_history TO authenticated;
GRANT ALL ON public.live_stream_history TO service_role;

DROP POLICY IF EXISTS "live_stream_history_select" ON public.live_stream_history;
CREATE POLICY "live_stream_history_select" ON public.live_stream_history
  FOR SELECT TO authenticated USING (true);

