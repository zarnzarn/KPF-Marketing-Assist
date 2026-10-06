# KPF-Marketing-Assist

**AI Marketing Director Secretary** for Klong Phai Farm — Phase 1 prototype.

> Prototype only. **Mock data only.** No real AI, no database, no external integrations.
> Nothing is ever sent, published, repriced or launched from this app.
> See [AGENTS.md](AGENTS.md) for the project rules.

## Run it

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

## Check it

```bash
pnpm test           # unit + component + accessibility tests (vitest)
pnpm typecheck      # TypeScript
pnpm lint           # ESLint
pnpm build          # production build
pnpm build && pnpm start -p 3100   # then, in another terminal:
pnpm test:e2e       # responsive layout + keyboard checks in a real browser
```

## Where things are

| Folder | What it holds |
| --- | --- |
| `src/app/` | The 13 pages (Today, AI Secretary, Marketing, Sales, Products, Customers & B2B, Tasks, Calendar, Meetings, Campaigns, Content, Reports, Documents) |
| `src/components/` | Reusable UI pieces |
| `src/data/mock/` | All mock data (the only place data comes from) |
| `src/lib/` | Business logic (queries, approvals, tasks, dates) — no UI code |
| `src/lib/ai/` | The mock AI secretary: tool selection and labelled answers (FACT / ANALYSIS / ESTIMATE / RECOMMENDATION / DATA GAP) |
| `tests/` | Tests |

## Use your own monthly reports (stays on your computer)

The Reports, Sales and AI Secretary pages can read your monthly marketing reports (Word `.docx` files).
The files are read straight from a folder on your computer. They are **never copied into the project and never pushed to GitHub**.

1. Copy `.env.example` to a new file called `.env.local` (same folder).
2. Put your folder in it, using forward slashes, even on Windows:
   ```
   REPORTS_DIR=D:/Report/Monthly report
   ```
3. Restart the app (`Ctrl+C`, then `npm run dev`) and open **Reports**.

If `REPORTS_DIR` is empty or the folder is missing, a mock sample report is shown instead.
Rules for this exception are in [AGENTS.md](AGENTS.md).
