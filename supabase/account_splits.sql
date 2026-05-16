-- Splitwise-style shared expenses between team members (run in Supabase SQL Editor).
-- Then: NOTIFY pgrst, 'reload schema';

CREATE TABLE IF NOT EXISTS public.account_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reason TEXT NOT NULL,
  place TEXT,
  total_amount DECIMAL(12, 2) NOT NULL CHECK (total_amount > 0),
  payer_profile_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by_profile_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  split_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.account_split_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  split_id UUID NOT NULL REFERENCES public.account_splits(id) ON DELETE CASCADE,
  participant_profile_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_amount DECIMAL(12, 2) NOT NULL CHECK (share_amount >= 0),
  paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (split_id, participant_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_account_splits_payer ON public.account_splits(payer_profile_id);
CREATE INDEX IF NOT EXISTS idx_account_splits_created_by ON public.account_splits(created_by_profile_id);
CREATE INDEX IF NOT EXISTS idx_account_split_shares_participant ON public.account_split_shares(participant_profile_id);
CREATE INDEX IF NOT EXISTS idx_account_split_shares_split ON public.account_split_shares(split_id);

ALTER TABLE public.account_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_split_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_splits_select ON public.account_splits;
CREATE POLICY account_splits_select ON public.account_splits
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS account_splits_insert ON public.account_splits;
CREATE POLICY account_splits_insert ON public.account_splits
  FOR INSERT TO authenticated
  WITH CHECK (created_by_profile_id = auth.uid());

DROP POLICY IF EXISTS account_split_shares_select ON public.account_split_shares;
CREATE POLICY account_split_shares_select ON public.account_split_shares
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS account_split_shares_insert ON public.account_split_shares;
CREATE POLICY account_split_shares_insert ON public.account_split_shares
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.account_splits s
      WHERE s.id = split_id AND s.created_by_profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS account_split_shares_update ON public.account_split_shares;
CREATE POLICY account_split_shares_update ON public.account_split_shares
  FOR UPDATE TO authenticated
  USING (
    participant_profile_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.account_splits s
      WHERE s.id = split_id
        AND (s.payer_profile_id = auth.uid() OR s.created_by_profile_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'editor')
    )
  );
