# Achievements assets

## Intro video (required path for the app)

The browser can only load videos from the **project’s `public` folder**, not from `Downloads` or other paths.

**Your file:** `~/Downloads/Pirates intro.MP4`

**One-time setup** (Terminal, from your machine):

```bash
cp "/Users/emmanueljacobkanagala/Downloads/Pirates intro.MP4" "/Users/emmanueljacobkanagala/Desktop/PIRATES/public/achievements/intro.mp4"
```

Adjust the second path if your project folder is elsewhere. After copying, the app uses:

`public/achievements/intro.mp4` → URL **`/achievements/intro.mp4`**

- Prefer **H.264 + AAC** in an `.mp4` container.
- Intro: slight zoom (~**6%**), **no native WebKit controls** (avoids the small white play dot). **Volume starts at 100%** and we try **sound on first**; if the browser mutes autoplay, **tap once on the video** (or use Volume) to turn sound on. Length ≈ **8 seconds**. **Skip** continues to achievements.
- If `intro.mp4` is missing or invalid, the intro step is skipped automatically.

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
