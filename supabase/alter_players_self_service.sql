-- Allow each logged-in user to have one player card linked via profile_id, and to update it (photo/name from profile).
-- Run in Supabase SQL Editor after players table exists.

CREATE UNIQUE INDEX IF NOT EXISTS players_profile_id_unique
  ON public.players (profile_id)
  WHERE profile_id IS NOT NULL;

DROP POLICY IF EXISTS "Users insert own player card" ON public.players;
CREATE POLICY "Users insert own player card" ON public.players
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "Users update own player card" ON public.players;
CREATE POLICY "Users update own player card" ON public.players
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
