-- Date of birth for profiles (replaces age in the app UI). Run in Supabase SQL Editor.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Refresh PostgREST schema cache so the API sees the new column (fixes "schema cache" errors).
NOTIFY pgrst, 'reload schema';
