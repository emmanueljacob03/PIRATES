-- Optional: remove in-app Pirates live chat table (replaced by embedded YouTube live chat).
-- Run only if you applied live_stream_chat.sql earlier.

DROP POLICY IF EXISTS live_stream_chat_insert ON public.live_stream_chat;
DROP POLICY IF EXISTS live_stream_chat_select ON public.live_stream_chat;

DROP TABLE IF EXISTS public.live_stream_chat;
