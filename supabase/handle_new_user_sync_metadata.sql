-- Run in Supabase SQL Editor (once). Copies phone + date_of_birth from signUp metadata into profiles at insert time.
-- SignUp uses options.data: { name, dob, phone } → raw_user_meta_data (photo still requires a session for Storage).

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
