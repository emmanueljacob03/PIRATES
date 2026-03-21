# .env.local – what goes where

Copy `.env.local.example` to `.env.local` and fill in **exactly** as below.

## 1. Project URL (only the URL)

- **Variable:** `NEXT_PUBLIC_SUPABASE_URL`
- **Where to get it:** Supabase Dashboard → **Settings** (gear) → **API** → **Project URL**
- **Example:** `https://abcdefghijk.supabase.co`
- **Use only this:** the full URL, nothing else. No spaces, no quote marks in the value.

```
NEXT_PUBLIC_SUPABASE_URL=https://abcdefghijk.supabase.co
```

## 2. Anon key OR Publishable key (same thing for this app)

- **Variable:** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **You can use either:**
  - **Anon key** (legacy): long string starting with `eyJ...` (JWT), or
  - **Publishable key** (new): string starting with `sb_publishable_...`
- **Where to get it:** Supabase Dashboard → **Settings** → **API** → under **Project API keys** use:
  - the key labeled **anon** / **anon public**, or
  - the key labeled **publishable** / **Publishable key**
- **Both work.** Paste only one of them here. Do **not** put the Project URL in this variable.

```
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
or
```
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

## 3. Security code (optional)

- **Variable:** `PIRATES_SECURITY_CODE`
- Default is `Pirates102`. Change it if you want a different code.

## 4. OpenWeather (optional)

- **Variable:** `OPENWEATHER_API_KEY`
- Only needed for weather on the Match Schedule page.

---

**Checklist**

- [ ] `NEXT_PUBLIC_SUPABASE_URL` = **only** the Project URL (e.g. `https://xxx.supabase.co`)
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` = **only** the anon/public key (long `eyJ...` string), **not** the URL
- [ ] No spaces around the `=` sign
- [ ] File saved and dev server restarted after changing `.env.local`
