-- Match fee / donation notes and who submitted (for viewer entries).
ALTER TABLE public.contributions
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS submitted_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
