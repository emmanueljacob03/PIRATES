-- Persists “Desired collections (Current Season)” on the dashboard (survives serverless deploys).
-- Run in Supabase SQL Editor once.
-- Optional: also run team_chat_settings_anon_select.sql if reads fail without SUPABASE_SERVICE_ROLE_KEY on the host.

ALTER TABLE public.team_chat_settings
  ADD COLUMN IF NOT EXISTS desired_collection TEXT;

COMMENT ON COLUMN public.team_chat_settings.desired_collection IS 'Dashboard: desired collection $ target for current season';
