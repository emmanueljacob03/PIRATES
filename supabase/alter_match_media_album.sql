-- Run in Supabase SQL Editor (or migrate) so "Others" album + filters work.
ALTER TABLE public.match_media
  ADD COLUMN IF NOT EXISTS album TEXT NOT NULL DEFAULT 'main'
  CHECK (album IN ('main', 'others'));

COMMENT ON COLUMN public.match_media.album IS 'main = Photos/Videos folders; others = Other media (mixed).';
