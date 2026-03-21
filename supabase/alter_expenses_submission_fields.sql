-- Add fields needed for viewer->admin expense approval notifications.
-- Run once in Supabase SQL Editor.

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS submitted_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS submitted_by_name TEXT;

