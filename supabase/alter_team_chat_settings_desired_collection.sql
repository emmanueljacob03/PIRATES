-- Persists “Desired collections (Current Season)” on the dashboard (survives serverless deploys).
-- Run in Supabase SQL Editor once.

ALTER TABLE public.team_chat_settings
  ADD COLUMN IF NOT EXISTS desired_collection TEXT;

COMMENT ON COLUMN public.team_chat_settings.desired_collection IS 'Dashboard: desired collection $ target for current season';
