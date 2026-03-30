# 🏏 Pirates Cricket Team Portal

A full-stack team portal for the Pirates cricket team: login, security code, dashboard, jerseys, budget, match schedule with weather, match media, leaderboard, and player profiles.

## Stack

- **Frontend:** Next.js 14 (App Router)
- **Backend + DB + Auth:** Supabase
- **Weather:** OpenWeather API

## Setup

### 1. Clone and install

```bash
cd PIRATES
npm install
```

### 2. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In **SQL Editor**, run the contents of `supabase/schema.sql`.
3. In **Authentication → Providers**, enable Email (and optionally confirm email off for quick testing).
4. In **Storage**, create two public buckets: `avatars`, `match-media` (optional; for profile and media uploads).

### 3. Environment variables

Copy `.env.local.example` to `.env.local` and set:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
PIRATES_SECURITY_CODE=Pirates102
OPENWEATHER_API_KEY=your-openweather-api-key
```

- Get URL and anon key from Supabase **Settings → API**.
- Get an API key from [OpenWeather](https://openweathermap.org/api).

### 4. Run locally

```bash
npm run dev
```

Open **http://localhost:4000** (or the port shown in the terminal). Sign up, then enter the security code (e.g. `Pirates102`) to reach the dashboard.

### 5. Deploy (e.g. Vercel)

1. Push the repo to GitHub and import the project in Vercel.
2. Add the same env vars in Vercel (including `PIRATES_SECURITY_CODE` and `OPENWEATHER_API_KEY`).
3. Deploy. Your site will be like `https://pirates-cricket.vercel.app`.

## Features

- **Login / Sign up** – Email + password; sign up collects name, age, phone, profile pic.
- **Security code** – After login, users must enter the Pirates code (e.g. `Pirates102`) to access the dashboard.
- **Dashboard** – Total players, total budget, expenses, remaining budget, next match, current MVP.
- **Jerseys** – Lookup by name/number; request new jersey (unique number enforced).
- **Team Budget** – Player contributions and expenses with auto totals.
- **Match Schedule** – List and calendar; add matches; weather via OpenWeather with advisories (hot/cold/rain).
- **Match Media** – Per-match folders; add photos/videos/highlights (links, e.g. Supabase Storage or Google Drive).
- **Leaderboard** – Best batsman, best bowler, best fielder, MVP (points use the same fantasy rules as the scorecard: batting tiers, **7 per wicket** + maidens/economy for bowling, **3 per catch/run-out** for fielding).
- **Players** – Grid of player cards (photo, name, jersey, role); click for full profile with stats from scorecards.
- **Scorecards** – From Schedule, “Add / Edit scorecard” per match; enter runs, balls, overs, wickets, etc. Stats feed leaderboard and player profiles.

### Scorecard OCR — bowling and points

- **Fantasy bowling points** are implemented in `lib/cricket-points.ts` (`bowlingPointsFromRow`): **7 points per wicket**, maidens/economy bonuses on top — not the old “wickets × 20” shorthand.
- **Tesseract** on phone screenshots often merges table cells, e.g. **4.0 → 40**, **5.00 → 500**, **1.0 → 170**, **12.50 → 1250**. The bowling parser in `lib/bowling-ocr.ts` normalises those patterns where it can.
- **Pipeline order** (after line extraction): implicit maiden insert when **M=0** is missing → **repairOcrTenTimesOvers** (×10 overs glue, with guards so real **runs** like 20 are not turned into 2.0 overs) → **squashEconomyOcrGluedDigits** (ER×100 style tokens) → **repairBowlingNumberSequence** (split dot overs).
- The scorecard form only persists **O, M, R, W** from bowling OCR (not wides/no-balls columns). Bowling images are read with **column-friendly** page segmentation where possible (`ScorecardForm` + Tesseract `SINGLE_COLUMN`).
- **Split names** across two OCR lines (e.g. surname-only row under “Emmanuel Jacob … 1.0 0 20…”) are handled by **`findBowlingLineForPlayer`**: it uses the stats line when the match would otherwise anchor on an empty surname row.
- **Read order** on “Read”: each bowling image is OCR’d **twice** (column + block), results concatenated, then **preprocessBowlingOcrLines** merges split name/stats rows; batting runs in block mode after that.

## Roles (RLS)

- **Admin** – Create matches, edit jerseys, upload scorecards, manage budget/expenses, add players.
- **Editor** – Upload media, add stats, manage jerseys/contributions/expenses/players.
- **Viewer** – View only.

Set a user’s role in Supabase: `profiles.role` = `admin` | `editor` | `viewer`. Default for new signups is `viewer`.

## Security code

Only users who know the code (e.g. `Pirates102`) can pass the gate. Stored in env as `PIRATES_SECURITY_CODE` and checked server-side; a cookie is set on success.

## File overview

- `app/` – Routes: login (home), `/code`, `/dashboard`, `/jerseys`, `/budget`, `/schedule`, `/media`, `/media/[matchId]`, `/leaderboard`, `/players`, `/players/[id]`, `/schedule/[matchId]/scorecard`.
- `components/` – Login, code gate, nav, dashboard stats, jerseys, budget, schedule, media, leaderboard, players, scorecard form.
- `lib/supabase.ts` – Browser Supabase client.
- `lib/supabase-server.ts` – Server Supabase client (for RLS).
- `supabase/schema.sql` – Tables and RLS policies.
- `app/api/verify-code/route.ts` – Security code verification (sets cookie).
- `app/api/logout/route.ts` – Clears code cookie.
- `app/api/weather/route.ts` – OpenWeather proxy.

## Optional improvements

- Live scoreboard, ranking charts, match win prediction, auto MVP announcement, team announcements, mobile UI tweaks.
