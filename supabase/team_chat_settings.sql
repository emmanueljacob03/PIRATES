-- Singleton row for team chat room header image (any authenticated user can update).
-- Run in Supabase SQL Editor after team_chat_messages exists.

CREATE TABLE IF NOT EXISTS public.team_chat_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  header_image_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.team_chat_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.team_chat_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_chat_settings_select" ON public.team_chat_settings;
CREATE POLICY "team_chat_settings_select" ON public.team_chat_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "team_chat_settings_insert" ON public.team_chat_settings;
CREATE POLICY "team_chat_settings_insert" ON public.team_chat_settings
  FOR INSERT TO authenticated WITH CHECK (id = 1);

DROP POLICY IF EXISTS "team_chat_settings_update" ON public.team_chat_settings;
CREATE POLICY "team_chat_settings_update" ON public.team_chat_settings
  FOR UPDATE TO authenticated USING (id = 1) WITH CHECK (id = 1);
