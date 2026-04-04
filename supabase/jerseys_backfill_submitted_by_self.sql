-- Generic backfill: set submitted_by_id only when the jersey clearly belongs to one account
-- (same person as player_name). No hard-coded player names.
-- Run in Supabase SQL Editor after reviewing row counts.

-- A) player_name matches a roster (players) row → submitter = that player’s profile
UPDATE public.jerseys AS j
SET submitted_by_id = pl.profile_id
FROM public.players AS pl
WHERE j.submitted_by_id IS NULL
  AND pl.profile_id IS NOT NULL
  AND length(trim(coalesce(pl.name, ''))) > 0
  AND lower(trim(regexp_replace(j.player_name, '\s+', ' ', 'g')))
    = lower(trim(regexp_replace(pl.name, '\s+', ' ', 'g')));

-- B) player_name matches a profile legal name (no roster row yet) → submitter = that profile
UPDATE public.jerseys AS j
SET submitted_by_id = p.id
FROM public.profiles AS p
WHERE j.submitted_by_id IS NULL
  AND length(trim(coalesce(p.name, ''))) > 0
  AND lower(trim(regexp_replace(j.player_name, '\s+', ' ', 'g')))
    = lower(trim(regexp_replace(p.name, '\s+', ' ', 'g')));

-- Friend / different-name requests (e.g. player_name = Sathvika, Joseph paid) still need
-- submitted_by_id set manually or via the app after a new request, unless you add that UUID here once.
