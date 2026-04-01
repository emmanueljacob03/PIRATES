-- Account approval: new signups are pending until an admin approves.
-- Run in Supabase SQL Editor.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'approved'
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

UPDATE public.profiles SET approval_status = 'approved' WHERE approval_status IS NULL;

-- New auth users start as pending (handled in trigger below).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    name,
    role,
    approval_status,
    phone,
    date_of_birth
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    'viewer',
    'pending',
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), ''),
    CASE
      WHEN NEW.raw_user_meta_data->>'dob' IS NOT NULL
        AND LENGTH(TRIM(NEW.raw_user_meta_data->>'dob')) > 0
      THEN SUBSTRING(TRIM(NEW.raw_user_meta_data->>'dob'), 1, 10)::DATE
      ELSE NULL
    END
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admins may update any profile (approve/reject signups, roles, etc.)
DROP POLICY IF EXISTS "Admins update any profile" ON public.profiles;
CREATE POLICY "Admins update any profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
