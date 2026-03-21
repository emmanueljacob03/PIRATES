-- Demo rows to trigger 72h reminders (bell + sliding cards).
-- Run in Supabase SQL Editor (or `psql`). Uses America/Chicago calendar dates.
-- Inserts: (1) Match vs India tomorrow 2:00 PM CT (2) Practice tomorrow 6:00 PM CT
-- Both are always within the next ~3 days from when you run this script.

INSERT INTO public.matches (date, time, opponent, ground)
VALUES
  (
    ((now() AT TIME ZONE 'America/Chicago')::date + 1),
    '14:00',
    'India',
    'Home Ground'
  ),
  (
    ((now() AT TIME ZONE 'America/Chicago')::date + 1),
    '18:00',
    'Practice Session',
    'Nets'
  );
