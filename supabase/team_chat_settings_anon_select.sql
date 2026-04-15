-- Lets the dashboard read `desired_collection` via the anon key when the server has no service role (optional).
-- Run in Supabase SQL Editor after team_chat_settings exists.
-- Exposes header_image_url to anon as well (same row); acceptable for most team sites.

DROP POLICY IF EXISTS "team_chat_settings_anon_select" ON public.team_chat_settings;
CREATE POLICY "team_chat_settings_anon_select" ON public.team_chat_settings
  FOR SELECT TO anon USING (true);
