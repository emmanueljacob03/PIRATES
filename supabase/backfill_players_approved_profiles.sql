-- One-time: create players rows for approved profiles that don't have a card yet.
-- Run in Supabase SQL Editor after approval flow changes.
INSERT INTO public.players (name, photo, profile_id, role)
SELECT
  COALESCE(NULLIF(TRIM(p.name), ''), NULLIF(TRIM(p.email), ''), 'Player'),
  p.avatar_url,
  p.id,
  'Player'
FROM public.profiles p
WHERE p.approval_status = 'approved'
  AND p.id NOT IN (SELECT profile_id FROM public.players WHERE profile_id IS NOT NULL);
