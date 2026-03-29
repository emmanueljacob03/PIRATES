-- Run once in Supabase SQL Editor if scorecard save fails on missing columns (schema cache).
-- Idempotent: safe to re-run.

ALTER TABLE public.match_stats
  ADD COLUMN IF NOT EXISTS fours INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sixes INT NOT NULL DEFAULT 0;

ALTER TABLE public.match_stats
  ADD COLUMN IF NOT EXISTS include_bat BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS include_bowl BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS include_field BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS maidens INT NOT NULL DEFAULT 0;
