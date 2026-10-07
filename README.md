# KPF-Marketing-Assist

**AI Marketing Director Secretary** for Klong Phai Farm. A web app for one user (the Marketing Director): online with a login, or on your own computer.

> **No sample data.** Everything on screen comes from one of three places:
> 1. **What you type in** (tasks, meetings, customers, campaigns, content, issues). Saved in **your own online account** (or, when run locally, in your browser).
> 2. **Your monthly marketing reports** (Word `.docx` files), uploaded in the app (or, locally, read from a folder on your computer).
> 3. **Read-only connections** to your own channels: website, Google Analytics 4, shop, Facebook, Instagram and LINE OA.
>
> When something is missing, the app says **"Data not available."** It never sends, publishes, changes prices or launches anything.
> Project rules: [AGENTS.md](AGENTS.md).

## Put it online (step by step)

You need three free accounts. You create them yourself; nobody else gets your keys.

**1. Supabase (login and saving)**
1. Go to supabase.com, sign up, and create a project. Region: **Southeast Asia (Singapore)**.
2. Open **SQL Editor**, click **New query**, paste everything from `supabase/schema.sql`, and click **Run**.
3. Open **Authentication, Users, Add user, Create new user**. Type your email address (no password needed).
4. Open **Authentication, Sign In / Providers**: turn **off** "Allow new users to sign up".
5. Open **Project Settings, API**: copy the **Project URL** and the **publishable (anon) key**.
6. Optional, so the login link also works when opened on another device: **Authentication, Emails, Magic Link**, and replace the link in the template with
   `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email`

**2. Ollama (AI answers, optional)**
1. Sign in at ollama.com, open **Settings, Keys**, and create a key. The free plan includes `gemma4:cloud`.

**3. Vercel (the web address)**
1. Sign up at vercel.com **with your GitHub account** and import the `kpf-marketing-assist` repository.
2. Region: **Singapore (sin1)** (Project, Settings, Functions).
3. In **Project, Settings, Environment Variables** add:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (from step 1.5)
   - `ALLOWED_EMAIL` (your email address, the same as in step 1.3)
   - `OLLAMA_API_KEY` (from step 2, optional)
   - any channel settings from `.env.example` (for GA4 online, paste the key file's contents into `GA4_SERVICE_ACCOUNT_JSON`)
4. Click **Deploy**. Copy your web address (for example `https://kpf-marketing-assist.vercel.app`).
5. Back in Supabase, **Authentication, URL Configuration**: set **Site URL** to that address and add `https://YOUR-ADDRESS/auth/callback` under **Redirect URLs**.
6. Open the address, type your email, and click the link in the email. Then:
   - Today page: **Move entries to my account** (if you used the app on this computer before)
   - Reports page: upload your monthly report files
   - Channels page: **Test the AI connection**

Costs to know: Vercel's free plan is for personal, non-commercial use; for a business tool Vercel asks for the Pro plan (about US$20 a month). Supabase's free plan pauses a project after about a week without use (open the app regularly, or upgrade). Ollama's free plan has usage limits.

Privacy: entries and reports are stored only in your own Supabase project, behind your login. For AI answers, the question and the related entries, report text and channel numbers are sent to Ollama.

## Run it on your own computer

```bash
npm install
npm run dev            # then open http://localhost:3000
```

### Good to know

- Pages first show **"Loading your saved entries…"** for a moment while your browser's entries are read.
- If your browser blocks saving (for example a private window or full storage), a **red warning** appears at the top. Entries then last only until you close the page.
- Anything not entered or not sent by a channel is shown as **"Data not available."** (for example a blank budget or a stock count the shop does not track). It is never filled in with 0 or today's date.

## Your settings (`.env.local`, on your own computer)

1. Copy `.env.example` to a new file called `.env.local` in the project folder.
   In PowerShell: `copy .env.example .env.local`
2. Fill in only what you have. Empty lines simply show "Not connected".
3. Use forward slashes in paths, even on Windows.
4. Restart the app after any change (`Ctrl+C`, then `npm run dev`).

`.env.local` is never committed to GitHub.

### Monthly reports

```
REPORTS_DIR=D:/Report/2026
```

Month folders are fine (for example `D:/Report/2026/Sep - 2026/Marketing_Report_….docx`).
Only Word files whose name or title contains "Marketing Report" are used. The files are read from your computer each time and are never copied into the project.

### Channels (website, GA4, shop, Facebook, Instagram, LINE OA)

Open the **Channels** page in the app. Each channel shows whether it is connected and has a **How to connect** section with step-by-step instructions and the exact lines to add to `.env.local`.

- The **website** needs no setup (it reads your public pages).
- **GA4** needs a read-only service-account key file. Keep it **outside** the project folder.
- The **shop** needs to know your platform (Shopify or WooCommerce) and a read-only key. For Shopify, `SHOP_URL` is the `…myshopify.com` address, not your public domain.
- **Facebook / Instagram** need a Meta Page access token. **LINE OA** needs a Messaging API channel access token (the `lin.ee` link alone is not enough).

All channel calls are read-only and go through one guarded function (`src/lib/channels/readOnlyFetch.ts`).
Numbers are refreshed at most every 15 minutes.

## Check it

```bash
npm test               # unit, page and accessibility tests (no internet needed)
npm run typecheck      # TypeScript
npm run lint           # ESLint
npm run build          # production build
npm run build && npm start -- -p 3100   # then, in another terminal:
npm run test:e2e       # responsive layout + keyboard checks in a real browser (local mode)
# Login checks: start the server with fake Supabase settings, then  E2E_MODE=online npm run test:e2e
# Setup page:   start the server with VERCEL=1 and no Supabase settings, then  E2E_MODE=setup npm run test:e2e
```

## Where things are

| Folder | What it holds |
| --- | --- |
| `src/app/(app)/` | The pages behind the login (Today, AI Secretary, Marketing, Sales, Products, Customers & B2B, Tasks, Calendar, Meetings, Campaigns, Content, Reports, Documents, Channels) |
| `src/app/login`, `src/app/auth` | Login page and the email-link handler |
| `src/lib/auth/`, `src/lib/supabase/`, `src/proxy.ts` | Login checks (one allowed email) |
| `supabase/schema.sql` | Database tables and storage rules, pasted once into Supabase |
| `src/components/` | Reusable UI pieces; `views/` holds each page's interactive part |
| `src/lib/` | Business logic (pure functions over your data), forms, dates |
| `src/lib/store/` | Your entries: saved in your Supabase account (online) or this browser (local) |
| `src/lib/reports/` | Reads monthly report `.docx` files |
| `src/lib/channels/` | Read-only channel connections |
| `src/lib/ai/` | The AI secretary: rule-based tools plus Ollama answers, checked in code (labelled FACT / ANALYSIS / ESTIMATE / RECOMMENDATION / DATA GAP) |
| `src/data/brand.ts` | Brand tone and content rules |
| `tests/` | Tests. `tests/fixtures/` is fictional data used only by tests |
