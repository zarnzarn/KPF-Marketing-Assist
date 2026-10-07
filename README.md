# KPF-Marketing-Assist

**AI Marketing Director Secretary** for Klong Phai Farm. Phase 1 prototype.

> **No sample data.** Everything on screen comes from one of three places:
> 1. **What you type in** (tasks, meetings, customers, campaigns, content, issues). Saved **only in your browser**.
> 2. **Your monthly marketing reports** (Word `.docx` files), read from a folder on your computer.
> 3. **Read-only connections** to your own channels: website, Google Analytics 4, shop, Facebook, Instagram and LINE OA.
>
> When something is missing, the app says **"Data not available."** It never sends, publishes, changes prices or launches anything.
> Project rules: [AGENTS.md](AGENTS.md).

## Run it

```bash
npm install
npm run dev            # then open http://localhost:3000
```

### Good to know

- Pages first show **"Loading your saved entries…"** for a moment while your browser's entries are read.
- If your browser blocks saving (for example a private window or full storage), a **red warning** appears at the top. Entries then last only until you close the page.
- Anything not entered or not sent by a channel is shown as **"Data not available."** (for example a blank budget or a stock count the shop does not track). It is never filled in with 0 or today's date.

## Your settings (`.env.local`)

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
npm run test:e2e       # responsive layout + keyboard checks in a real browser
```

## Where things are

| Folder | What it holds |
| --- | --- |
| `src/app/` | The pages (Today, AI Secretary, Marketing, Sales, Products, Customers & B2B, Tasks, Calendar, Meetings, Campaigns, Content, Reports, Documents, Channels) |
| `src/components/` | Reusable UI pieces; `views/` holds each page's interactive part |
| `src/lib/` | Business logic (pure functions over your data), forms, dates |
| `src/lib/store/` | Your entries, saved in this browser only |
| `src/lib/reports/` | Reads monthly report `.docx` files |
| `src/lib/channels/` | Read-only channel connections |
| `src/lib/ai/` | The rule-based AI secretary (labelled answers: FACT / ANALYSIS / ESTIMATE / RECOMMENDATION / DATA GAP) |
| `src/data/brand.ts` | Brand tone and content rules |
| `tests/` | Tests. `tests/fixtures/` is fictional data used only by tests |
