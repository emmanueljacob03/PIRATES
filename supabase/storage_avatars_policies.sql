-- Run in Supabase SQL Editor if profile photo upload from the app hangs or returns “new row violates row-level security”.
-- Ensure bucket exists: Dashboard → Storage → New bucket → id: avatars → Public.
--
-- Paths must start with the user’s UUID as the first segment, e.g. `{uuid}/avatar.jpg` or `{uuid}/team-chat/123.jpg`.
-- Do NOT use `team-chat/{uuid}/...` (first segment would be `team-chat` and INSERT will fail RLS).

-- Allow anyone to read avatar files (bucket is public)
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');

-- Authenticated users can upload/update/delete only under their user id folder: {userId}/...
DROP POLICY IF EXISTS "Users upload own avatars folder" ON storage.objects;
CREATE POLICY "Users upload own avatars folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users update own avatars folder" ON storage.objects;
CREATE POLICY "Users update own avatars folder" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users delete own avatars folder" ON storage.objects;
CREATE POLICY "Users delete own avatars folder" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
