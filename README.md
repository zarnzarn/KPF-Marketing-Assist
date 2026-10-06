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
