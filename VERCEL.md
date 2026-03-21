# Deploying on Vercel

## 1. Environment variables (required for a working app)

In Vercel: **Project → Settings → Environment Variables**, add the same names as `.env.local.example`:

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | From Supabase project settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** — never expose in client code |
| `PIRATES_SECURITY_CODE` | Team entry code |
| `OPENWEATHER_API_KEY` | Optional if you use weather |

Optional: `NEXT_PUBLIC_INTRO_VIDEO_URL`, `PIRATES_ADMIN_CODE`.

After adding or changing variables, **Redeploy** (Deployments → … → Redeploy).

## 2. If the build still fails

1. Open the failed deployment → **Building** → expand the log.
2. Search for `Error`, `Failed`, or `ELIFECYCLE`.
3. Common causes:
   - **Missing env** at build time (rare here; most env is runtime).
   - **TypeScript errors** — run `npm run build` locally and fix errors.
   - **Large repo / timeout** — unusual for this project.

## 3. Local check before pushing

```bash
npm run build
```

If that passes, Vercel usually passes too (same command).

## 4. Repo fixes (Next.js + Vercel)

- **`/api/upcoming-matches`** — `dynamic = 'force-dynamic'` (uses `cookies()`).
- **`/login`** — `dynamic = 'force-dynamic'` so the build does not statically prerender a page that pulls in the Supabase **browser** client (`createClientComponentClient`), which can throw during `next build` on Vercel.
