-- If team_chat_settings already exists but INSERT was missing (RLS error on upsert), run this in Supabase SQL Editor.

DROP POLICY IF EXISTS "team_chat_settings_insert" ON public.team_chat_settings;
CREATE POLICY "team_chat_settings_insert" ON public.team_chat_settings
  FOR INSERT TO authenticated WITH CHECK (id = 1);

INSERT INTO public.team_chat_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
