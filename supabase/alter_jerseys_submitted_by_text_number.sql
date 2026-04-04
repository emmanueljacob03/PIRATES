-- Jerseys: track who submitted the request (owes $) and preserve jersey number as text (e.g. "06" vs "6").
-- Run in Supabase SQL Editor once.

ALTER TABLE public.jerseys
  ADD COLUMN IF NOT EXISTS submitted_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- INT -> TEXT keeps unique constraint name; values become '1', '2', …
ALTER TABLE public.jerseys
  ALTER COLUMN jersey_number TYPE TEXT USING jersey_number::TEXT;

COMMENT ON COLUMN public.jerseys.submitted_by_id IS 'Profile user who submitted the jersey request; unpaid amount counts toward their "owe" total.';
