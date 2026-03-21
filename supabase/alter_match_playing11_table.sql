-- Add match Playing 11 / Extras assignment table.
-- Run in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.match_playing11 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('playing11', 'extra')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, player_id)
);

ALTER TABLE public.match_playing11 ENABLE ROW LEVEL SECURITY;

-- Read: authenticated users (admin + viewer) can see who is marked for a match.
DROP POLICY IF EXISTS "Authenticated read match_playing11" ON public.match_playing11;
CREATE POLICY "Authenticated read match_playing11" ON public.match_playing11
  FOR SELECT TO authenticated USING (true);

-- Write: admins only.
DROP POLICY IF EXISTS "Admin manage match_playing11" ON public.match_playing11;
CREATE POLICY "Admin manage match_playing11" ON public.match_playing11
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin')
    )
  );

