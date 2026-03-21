# Achievements assets

## Intro video

### Option A — File in this repo (`public/`)

Put the file here (or copy from Downloads):

```bash
cp "/path/to/Pirates intro.MP4" "/path/to/PIRATES/public/achievements/intro.mp4"
```

App URL: **`/achievements/intro.mp4`**

### Option B — Hosted URL (no big MP4 in Git)

Upload the MP4 to any **HTTPS** URL the browser can request (CORS must allow your site to load the video — most CDNs/object storage do when the bucket is public).

| Where | How |
|--------|-----|
| **Supabase Storage** | Dashboard → Storage → new bucket (public) → Upload → copy **public** object URL |
| **Cloudflare R2 / AWS S3** | Upload file → enable public read (or signed URL) → use the object URL |
| **Vercel Blob** | `@vercel/blob` upload or dashboard → paste URL |
| **YouTube / Vimeo** | Not a direct MP4 URL in `<video src>`; you’d need their embed API instead |

Then in **`.env.local`** (and in Vercel/hosting **Environment Variables** for production):

```bash
NEXT_PUBLIC_INTRO_VIDEO_URL=https://your-cdn.example.com/path/intro.mp4
```

Rebuild/redeploy after changing env vars. If the URL is missing or the file fails to load, the intro step is skipped (same as a broken local file).

- Prefer **H.264 + AAC** in an `.mp4` container.
- Intro: slight zoom (~**6%**), **no native WebKit controls** (avoids the small white play dot). **Volume starts at 100%** and we try **sound on first**; if the browser mutes autoplay, **tap once on the video** (or use Volume) to turn sound on. Length ≈ **8 seconds**. **Skip** continues to achievements.
- If the video URL fails (missing file, bad URL, CORS), the intro step is skipped automatically.

---

## Images (achievements slideshow)

Each file is used in **one** topic only (no repeats across topics).

| Topic       | Files |
|------------|--------|
| **intro**  | `pirates1.png` |
| **club**   | `pirates2.png` (full-screen **cover**, centered on people; bottom of image cropped) |
| **ram**    | `ram.png`, `ram1.png` |
| **sampreeth** | `sampreeth1.png`, `sampreeth2.png`, `sampreeth-trophy.png` |
| **anil**   | `anil1.png`, `anil2.png`, `anil-trophy.png` |
| **abhinav** | `abhinav1.png`, `abhinav2.png`, `abhinav-trophy.png` |
| **outing** | `outing1.png`, `outing2.png` |

**Formats:** PNG (or WebP) recommended; keep filenames **exactly** as above (case-sensitive on Linux servers).
