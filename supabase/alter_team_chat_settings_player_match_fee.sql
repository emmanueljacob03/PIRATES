-- Standard player match fee ($) shown on profiles; set from Team Budget → Player match fee (admin).
-- Run in Supabase SQL Editor after team_chat_settings exists.

ALTER TABLE public.team_chat_settings
  ADD COLUMN IF NOT EXISTS player_match_fee TEXT;

COMMENT ON COLUMN public.team_chat_settings.player_match_fee IS
  'Team Budget: standard player match fee amount (dollars as text e.g. 120.00); drives profile WHAT YOU OWE display.';
