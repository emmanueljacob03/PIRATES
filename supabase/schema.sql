-- Pirates Cricket Portal - Supabase Schema
-- Run this in Supabase SQL Editor after enabling Auth
-- Safe to run multiple times: drops existing policies before creating them.

-- Profiles (extends auth.users; sync with trigger)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  age INT,
  date_of_birth DATE,
  phone TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer')),
  approval_status TEXT NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (drop first so re-running this script never fails)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Admins update any profile" ON public.profiles;
CREATE POLICY "Admins update any profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Jerseys
CREATE TABLE IF NOT EXISTS public.jerseys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name TEXT NOT NULL,
  jersey_number INT NOT NULL UNIQUE,
  size TEXT NOT NULL,
  paid BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.jerseys ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read jerseys" ON public.jerseys;
DROP POLICY IF EXISTS "Authenticated insert jerseys" ON public.jerseys;
DROP POLICY IF EXISTS "Admin/Editor update jerseys" ON public.jerseys;
DROP POLICY IF EXISTS "Admin delete jerseys" ON public.jerseys;
CREATE POLICY "Authenticated read jerseys" ON public.jerseys FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert jerseys" ON public.jerseys FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin/Editor update jerseys" ON public.jerseys FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
);
CREATE POLICY "Admin delete jerseys" ON public.jerseys FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Contributions
CREATE TABLE IF NOT EXISTS public.contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  paid BOOLEAN DEFAULT FALSE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read contributions" ON public.contributions;
DROP POLICY IF EXISTS "Admin/Editor manage contributions" ON public.contributions;
CREATE POLICY "Authenticated read contributions" ON public.contributions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Editor manage contributions" ON public.contributions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
);

-- Expenses
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  item TEXT NOT NULL,
  cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  bought BOOLEAN DEFAULT FALSE,
  submitted_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Add bought if table already existed without it (run this once if you get "bought column" error):
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS bought BOOLEAN DEFAULT FALSE;
-- Add submitter fields for viewer->admin approval notifications:
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS submitted_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS submitted_by_name TEXT;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admin/Editor manage expenses" ON public.expenses;
CREATE POLICY "Authenticated read expenses" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Editor manage expenses" ON public.expenses FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
);

-- Matches
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  time TEXT NOT NULL,
  opponent TEXT NOT NULL,
  ground TEXT NOT NULL,
  weather JSONB,
  advisory TEXT,
  is_practice BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read matches" ON public.matches;
DROP POLICY IF EXISTS "Admin create/update matches" ON public.matches;
CREATE POLICY "Authenticated read matches" ON public.matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin create/update matches" ON public.matches FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Match media
CREATE TABLE IF NOT EXISTS public.match_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('photo', 'video', 'highlight')),
  url TEXT NOT NULL,
  title TEXT,
  album TEXT NOT NULL DEFAULT 'main' CHECK (album IN ('main', 'others')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.match_media ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read match_media" ON public.match_media;
DROP POLICY IF EXISTS "Admin/Editor manage match_media" ON public.match_media;
CREATE POLICY "Authenticated read match_media" ON public.match_media FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Editor manage match_media" ON public.match_media FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
);

-- Players (team roster; can link to profile_id)
CREATE TABLE IF NOT EXISTS public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  photo TEXT,
  jersey_number INT,
  role TEXT NOT NULL DEFAULT 'Player',
  profile_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS players_profile_id_unique
  ON public.players (profile_id)
  WHERE profile_id IS NOT NULL;

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read players" ON public.players;
DROP POLICY IF EXISTS "Admin/Editor manage players" ON public.players;
DROP POLICY IF EXISTS "Users insert own player card" ON public.players;
DROP POLICY IF EXISTS "Users update own player card" ON public.players;
CREATE POLICY "Authenticated read players" ON public.players FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Editor manage players" ON public.players FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
);
CREATE POLICY "Users insert own player card" ON public.players
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());
CREATE POLICY "Users update own player card" ON public.players
  FOR UPDATE TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Match stats (scorecard per player per match)
CREATE TABLE IF NOT EXISTS public.match_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  runs INT DEFAULT 0,
  balls INT DEFAULT 0,
  fours INT NOT NULL DEFAULT 0,
  sixes INT NOT NULL DEFAULT 0,
  overs DECIMAL(5,1) DEFAULT 0,
  wickets INT DEFAULT 0,
  runs_conceded INT DEFAULT 0,
  catches INT DEFAULT 0,
  runouts INT DEFAULT 0,
  mvp BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(match_id, player_id)
);

ALTER TABLE public.match_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read match_stats" ON public.match_stats;
DROP POLICY IF EXISTS "Admin/Editor manage match_stats" ON public.match_stats;
CREATE POLICY "Authenticated read match_stats" ON public.match_stats FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Editor manage match_stats" ON public.match_stats FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'editor'))
);

-- Umpiring duties (who, when – visible to all, editable by admin)
CREATE TABLE IF NOT EXISTS public.umpiring_duties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  who TEXT NOT NULL,
  duty_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.umpiring_duties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone read umpiring_duties" ON public.umpiring_duties;
CREATE POLICY "Anyone read umpiring_duties" ON public.umpiring_duties FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin manage umpiring_duties" ON public.umpiring_duties;
CREATE POLICY "Admin manage umpiring_duties" ON public.umpiring_duties FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Security code (store hashed or plain for demo; use env in app)
-- App checks PIRATES_SECURITY_CODE env; no table needed.

-- Trigger: create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, approval_status)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), 'viewer', 'pending');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage bucket for avatars and match media (run in Supabase Dashboard if needed)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('match-media', 'match-media', true);
