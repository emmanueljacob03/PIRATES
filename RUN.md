# How to run the Pirates portal

## Which IDE you can use

- **Cursor** (what you have now) – Works great. It’s VS Code with AI; use the built-in terminal to run commands.
- **VS Code** – Same as Cursor without AI. Install the “ESLint” and “Tailwind CSS IntelliSense” extensions if you want.
- **Any editor** – You can use WebStorm, Sublime, Vim, etc. You only need a terminal to run the app; the IDE is for editing.

You don’t need a special IDE. As long as you can run `npm run dev` in a terminal from the **PIRATES** folder, you’re good.

---

## What to run and how

### 1. Open the project folder

In your IDE (or in Terminal / Command Prompt), go to the project folder:

```bash
cd /Users/emmanueljacobkanagala/Desktop/PIRATES
```

(Or on Windows: `cd C:\Users\...\Desktop\PIRATES` or wherever PIRATES is.)

### 2. Install dependencies (once)

If you haven’t already:

```bash
npm install
```

### 3. Start the app

```bash
npm run dev
```

### 4. Open in the browser

The app is set to run on **port 4000**. Open this link:

**http://localhost:4000**

If the terminal says “Port 4000 is in use, trying 4001”, use the URL it shows instead (e.g. **http://localhost:4001**). Always use the exact URL printed in the terminal.

### 5. Use the app

- **Login / Sign up** on the first screen.
- Then enter the **team code** (e.g. `Pirates102`) and click “Go to dashboard”.
- You’ll land on the dashboard (schedule, jerseys, budget, etc.).

---

## If something goes wrong

- **404** – The app runs on **http://localhost:4000** (or the port in the terminal). Do **not** use http://localhost:3000. Copy the `Local: http://localhost:XXXX` line from the terminal and open that exact URL.
- **Port in use** – If 4000 is busy, the terminal will show another port (e.g. 4001). Use that URL instead.
- **Clean run** – Delete the build cache and start again:
  ```bash
  rm -rf .next
  npm run dev
  ```
  (On Windows in PowerShell: `Remove-Item -Recurse -Force .next` then `npm run dev`.)

---

## Why it might not be working

- **404 / “This site can’t be reached”** – You’re opening the wrong address. The app runs on **http://localhost:4000** (or the port in the terminal). Do not use `http://localhost:3000` unless the terminal says the app is on 3000. After `npm run dev`, look for the line `Local: http://localhost:XXXX` and open that exact URL.
- **Stuck on the security code page** – Log in with email/password first, then enter the team code (e.g. `Pirates102`) and click “Go to dashboard”. Use the same URL you used for the login page (e.g. http://localhost:4000).
- **Blank or errors** – Run from the **PIRATES** folder, run `npm install` once, and ensure `.env.local` has your Supabase URL, anon key, and `PIRATES_SECURITY_CODE`.

---

## How to share the app (not just localhost)

**localhost** is only on your computer. Others can’t open `http://localhost:4000` from their devices. To share the app you have two options:

### Option 1: Deploy online (best for sharing)

Put the app on a host so it gets a **public URL** anyone can open:

1. Push your code to **GitHub** (create a repo and push the PIRATES project).
2. Go to [vercel.com](https://vercel.com), sign in, and click **Add New → Project**. Import your GitHub repo.
3. Add your **environment variables** in Vercel (same as `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `PIRATES_SECURITY_CODE`, `OPENWEATHER_API_KEY`).
4. Deploy. Vercel will give you a URL like **https://pirates-cricket-xxx.vercel.app** – share that link with your team.

No one needs to run anything on their machine; they just open the link.

### Option 2: Temporary tunnel (share your localhost)

To share your **current** running app without deploying:

1. With `npm run dev` running, in another terminal install and run **ngrok**:  
   `npx ngrok http 4000`  
   (Use 4001 if your app is on 4001.)
2. ngrok will show a public URL (e.g. `https://abc123.ngrok.io`). Share that link.
3. While your computer is on and ngrok is running, anyone with the link can open the app. When you stop ngrok or the dev server, the link stops working.

---

## Quick reference

| What            | Command / URL                          |
|-----------------|----------------------------------------|
| Start dev server| `npm run dev` (from PIRATES folder)     |
| Open app        | **http://localhost:4000** (or port in terminal) |
| Stop server     | Press `Ctrl+C` in the terminal          |
| Build for production | `npm run build`                    |
| Run production  | `npm run start` (after `npm run build`) |
