-- Date of birth for profiles (replaces age in the app UI). Run in Supabase SQL Editor.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
