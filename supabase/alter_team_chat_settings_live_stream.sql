-- Live stream (YouTube / Vimeo URL + on/off) for /live and public /watch.
-- Run in Supabase SQL Editor after team_chat_settings exists.

ALTER TABLE public.team_chat_settings
  ADD COLUMN IF NOT EXISTS live_stream_url TEXT,
  ADD COLUMN IF NOT EXISTS live_stream_active BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS live_stream_title TEXT;

COMMENT ON COLUMN public.team_chat_settings.live_stream_url IS 'YouTube or Vimeo page/embed URL; shown when live_stream_active is true.';
COMMENT ON COLUMN public.team_chat_settings.live_stream_active IS 'When true, /watch and /live show the embed.';
COMMENT ON COLUMN public.team_chat_settings.live_stream_title IS 'Optional label for the stream (e.g. vs Opponent).';
