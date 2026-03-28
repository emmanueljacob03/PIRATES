-- Optional: extras from batting scorecard screenshots (OCR / manual).
ALTER TABLE public.match_stats
  ADD COLUMN IF NOT EXISTS fours INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sixes INT NOT NULL DEFAULT 0;
