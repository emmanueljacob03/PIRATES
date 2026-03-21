# Pirates Cricket Portal – Step-by-step setup (beginner)

Follow these steps in order. Do not skip steps.

---

## Part 1: Supabase (your database and login)

### Step 1: Create a Supabase account

1. Open your browser and go to: **https://supabase.com**
2. Click **Start your project**
3. Sign up with **GitHub** or **Email** (use the one you have)
4. Confirm your email if asked

---

### Step 2: Create a new project

1. After login, click **New Project**
2. **Organization:** keep the default (or create one if asked)
3. **Name:** type `pirates-cricket` (or any name you like)
4. **Database Password:** make up a strong password and **write it down** (you need it only for the database, not for the app)
5. **Region:** choose the one closest to you (e.g. Southeast Asia, US East)
6. Click **Create new project**
7. Wait 1–2 minutes until the project is ready (you’ll see a green checkmark)

---

### Step 3: Get your project URL and anon key

1. In the left sidebar, click the **Settings** (gear) icon at the bottom
2. Click **API** in the left menu
3. You will see:
   - **Project URL** – something like `https://abcdefgh.supabase.co`
   - **Project API keys** – find the one named **anon** **public**
4. **Copy** the **Project URL** and paste it somewhere safe (e.g. Notepad)
5. **Copy** the **anon public** key and paste it somewhere safe
6. Do **not** share these or put them on GitHub; they are like passwords for your app

---

### Step 4: Put URL and key into your app

1. On your computer, open the project folder: **PIRATES**
2. Open the file **`.env.local`** (if you don’t see it, it might be hidden; in VS Code/Cursor it should still show in the file list)
3. Replace the placeholder values:
   - Find: `NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co`  
     Replace with: `NEXT_PUBLIC_SUPABASE_URL=` and then paste **your** Project URL (no space after `=`)
   - Find: `NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key`  
     Replace with: `NEXT_PUBLIC_SUPABASE_ANON_KEY=` and then paste **your** anon public key (no space after `=`)
4. Save the file (Ctrl+S or Cmd+S)

---

### Step 5: Run the database setup (SQL)

1. In Supabase, in the left sidebar, click **SQL Editor**
2. Click **New query**
3. Open your project folder **PIRATES** on your computer
4. Open the file **`supabase/schema.sql`**
5. Select **all** the text in that file (Ctrl+A or Cmd+A) and **copy** it (Ctrl+C or Cmd+C)
6. Go back to the Supabase **SQL Editor** and **paste** the text (Ctrl+V or Cmd+V)
7. Click the green **Run** button (or press Ctrl+Enter / Cmd+Enter)
8. At the bottom you should see: **Success. No rows returned.**  
   If you see red errors, copy the error message and ask for help.

---

### Step 6: Turn on Email login and set redirect URL

1. In Supabase left sidebar, click **Authentication**
2. Click **URL Configuration**
3. Under **Redirect URLs**, add: `http://localhost:3000/auth/callback`
4. Set **Site URL** to `http://localhost:3000`
5. Go to **Providers** and click **Email**
4. Make sure **Enable Email provider** is **ON**
5. (Optional, for easier testing) Turn **Confirm email** **OFF** so you don’t need to verify email to log in
6. Click **Save**

---

### Step 7: (Optional) Create storage buckets for photos

1. In Supabase left sidebar, click **Storage**
2. Click **New bucket**
3. **Name:** type `avatars`  
   **Public bucket:** turn **ON**  
   Click **Create bucket**
4. Click **New bucket** again
5. **Name:** type `match-media`  
   **Public bucket:** turn **ON**  
   Click **Create bucket**

If you skip this, the app still works; only profile pictures and match media uploads won’t work until you add these later.

---

## Part 2: OpenWeather (for match weather – optional)

### Step 8: Get a free OpenWeather API key

1. Go to: **https://openweathermap.org**
2. Click **Sign In** (top right) and create an account, or sign in
3. Go to: **https://home.openweathermap.org/api_keys**
4. You might see a default key, or click **Create Key** and give it a name (e.g. “Pirates”)
5. **Copy** the API key
6. Open **`.env.local`** in your PIRATES project
7. Find: `OPENWEATHER_API_KEY=your-openweather-api-key`  
   Replace with: `OPENWEATHER_API_KEY=` and paste your key (no space after `=`)
8. Save the file

If you skip this, the app works; only the weather on the Match Schedule page won’t load.

---

## Part 3: Run the app on your computer

### Step 9: Open Terminal in the project folder

- **Mac:** Open Terminal, then type:
  ```bash
  cd Desktop/PIRATES
  ```
  (If PIRATES is somewhere else, use that path instead.)
- **Windows:** Open Command Prompt or PowerShell, then type:
  ```bash
  cd Desktop\PIRATES
  ```
  (Adjust the path if your folder is elsewhere.)

---

### Step 10: Install and start the app

1. In the same terminal, run:
   ```bash
   npm install
   ```
   Wait until it finishes (no red errors).

2. Then run:
   ```bash
   npm run dev
   ```
   Wait until you see something like: **Local: http://localhost:3000**

3. Open your browser and go to: **http://localhost:3000**

---

## Part 4: Use the app

### Step 11: Create your account

1. On **http://localhost:3000** you should see **Pirates Cricket Portal** and a login form.
2. Click **Create account** (link below the Login button).
3. Fill in:
   - **Name** (e.g. your name)
   - **Age** (optional)
   - **Phone** (optional)
   - **Email** (use a real email you can access)
   - **Password** (at least 6 characters; remember it)
4. Click **Create account**.
5. If you left **Confirm email** ON in Supabase, check your email and confirm. If you turned it OFF, you can go to the next step.

---

### Step 12: Enter the security code

1. After signup (or after you click **Login** and enter email + password), you will see a screen: **Enter Pirates Security Code**.
2. The default code is: **Pirates102**
   - (You set this in `.env.local` as `PIRATES_SECURITY_CODE=Pirates102`; you can change it there later.)
3. Type **Pirates102** and click **Enter**.
4. You should now see the **Pirates Team Dashboard** with menu: Dashboard, Jerseys, Team Budget, Match Schedule, Match Media, Leaderboard, Players.

---

### Step 13: Try the app

- **Dashboard:** See summary (players, budget, next match, MVP).
- **Jerseys:** Search by name/number; request a new jersey.
- **Team Budget:** Add contributions and expenses.
- **Match Schedule:** Add a match; see weather if you added OpenWeather key.
- **Match Media:** Open a match and add photo/video links.
- **Leaderboard:** Appears once you add players and scorecards.
- **Players:** Add players (name, jersey number, role); click a player for full profile and stats.

To add scorecards (for leaderboard and player stats): go to **Match Schedule** → click **Add / Edit scorecard** on a match → fill runs, wickets, etc. for each player.

---

## If something goes wrong

- **“Invalid API key” or login errors:** Check `.env.local`: correct Supabase URL and anon key, no extra spaces, file saved.
- **Blank or broken page:** In the terminal where `npm run dev` is running, look for red errors; fix what they say or share the message.
- **SQL errors in Supabase:** Copy the full error from the SQL Editor and use it when asking for help.
- **App not loading:** Make sure you ran `npm run dev` and you’re opening **http://localhost:3000** (not https).

---

## Quick checklist

- [ ] Supabase account created  
- [ ] New Supabase project created  
- [ ] Project URL and anon key copied into `.env.local`  
- [ ] `supabase/schema.sql` run in Supabase SQL Editor  
- [ ] Email provider enabled in Authentication → Providers  
- [ ] (Optional) Storage buckets `avatars` and `match-media` created  
- [ ] (Optional) OpenWeather API key in `.env.local`  
- [ ] `npm install` and `npm run dev` run in PIRATES folder  
- [ ] Opened http://localhost:3000 and created account  
- [ ] Entered security code (e.g. Pirates102) and saw dashboard  

Done.
