-- Links umpiring rows to roster players and stores scheduled time (for "completed" after +4h).
-- Run in Supabase SQL Editor once.

ALTER TABLE public.umpiring_duties
  ADD COLUMN IF NOT EXISTS player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS duty_time TEXT DEFAULT '12:00';

COMMENT ON COLUMN public.umpiring_duties.player_id IS 'Roster player; who remains denormalized text';
COMMENT ON COLUMN public.umpiring_duties.duty_time IS 'HH:MM local time with duty_date';
