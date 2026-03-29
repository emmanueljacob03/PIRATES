-- Which scorecard sections include this player row; maidens for bowling OCR/points.
ALTER TABLE public.match_stats
  ADD COLUMN IF NOT EXISTS include_bat BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS include_bowl BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS include_field BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS maidens INT NOT NULL DEFAULT 0;
