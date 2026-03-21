-- Team-level "Others" folder: media not tied to a specific match.
-- Run in Supabase SQL Editor after alter_match_media_album.sql.

ALTER TABLE public.match_media
  ALTER COLUMN match_id DROP NOT NULL;

COMMENT ON COLUMN public.match_media.match_id IS 'NULL = team Others folder (see /media/others); otherwise FK to matches.';
