# AGENTS.md — AI Marketing Director Secretary

Instructions for any AI coding agent working in this repository.

## Project

- **Name:** AI Marketing Director Secretary
- **Company:** Klong Phai Farm (premium poultry and egg business, Thailand)
- **Phase:** Phase 2: online web app (single user)
- **Target user:** Marketing Director
- **Purpose:** An AI Marketing Executive Secretary and Marketing Business Assistant. It helps the Marketing Director to:
  - Organize daily marketing work, manage tasks, meetings, the marketing calendar and contacts
  - Manage B2B leads, customer follow-ups, campaigns and marketing activities
  - Analyze sales, product performance and marketing performance
  - Monitor business issues, customer complaints, and product availability and stock-related alerts
  - Review pricing information
  - Prepare campaign recommendations, content drafts, meeting briefings and follow-up lists
  - Summarize documents and analyze reports
  - Prioritize marketing work and prepare decisions for the Marketing Director

## Business context

Klong Phai Farm sells through several channels:

- **B2C:** website, LINE Official Account, social media, online channels
- **Retail:** supermarkets, gourmet / premium grocery, other retail partners
- **B2B:** hotels, restaurants, chefs, wholesale, corporate customers, other food-service customers

Key areas: free-range chicken, eggs, duck, specialty poultry products, premium frozen products, B2B food-service products, campaigns, product launches, events, PR, social media, content marketing, website, customer communication, B2B sales support.

## Development rules

- A real web app with two modes (`src/lib/mode.ts`):
  - **Online** (Supabase settings present, hosted on Netlify's free plan, or Vercel): one allowed login (`ALLOWED_EMAIL`, email link). Entries and uploaded reports are saved in the user's own Supabase project, protected by row-level security. No service-role key is used anywhere.
  - **Local** (no Supabase settings): entries in the browser (`localStorage`), reports from `REPORTS_DIR`. Used on the user's computer and in tests. On a host (Netlify or Vercel, see `onHost()`) the app never runs in local mode.
- **No mock data in the app.** Data comes only from:
  1. **The user's own entries** (tasks, meetings, customers, campaigns, content, issues, approvals, document names).
  2. **The user's monthly marketing report files** (`.docx`): uploaded in the online app, or read from a local folder.
  3. **Read-only connections to the brand's own channels** (website, GA4, shop, Facebook, Instagram, LINE OA) through their official APIs, using credentials the user creates.
- When a source is empty or not connected, show an empty state and say "Data not available." Never fill gaps with sample or invented data.
- `/mock/` holds clearly labelled MOCK DATA about a fictional company (Rai Thong Heritage Farm), for demos and AI testing only. The app never imports it (a test enforces this); regenerate it with `node mock/generate.mjs`.
- No real customer personal information: no private individuals' names, phone numbers or emails. Customer records are businesses or segments.
- The only database is the user's own Supabase project (tables in `supabase/schema.sql`). No n8n. No CRM, email, marketplace or payment integrations.
- Every page, server action and data loader checks the login on the server (`requireViewer()` in `src/lib/auth/session.ts`); the proxy is only a first, quick check.
- Keep the architecture simple. Prefer simple solutions. Do not over-engineer. Do not create unnecessary abstractions.
- Use maintainable TypeScript and reusable components.
- Separation of concerns: business logic separate from UI; AI tools separate from UI; data loading (store, reports, channels) separate from business logic. Queries are pure functions of `AppData`.
- Before implementing a major feature: explain what will be changed. Keep implementations modular.

## Real data rules

- **Report files** are uploaded to the user's private Supabase storage (online) or read at request time from `REPORTS_DIR` (local, default `data/private/reports`; sub-folders allowed). They are never copied into the repository.
- **Credentials** (channel tokens, keys, service-account JSON, `OLLAMA_API_KEY`) live only in `.env.local`, the host's environment variables (Netlify or Vercel) or files outside the repository. They are used only on the server, never sent to the browser, never written to logs or error messages. Only the Supabase URL and publishable key are public by design.
- **Read-only:** all channel HTTP calls go through `src/lib/channels/readOnlyFetch.ts`. It allows GET, plus POST only to endpoints that change nothing: Google sign-in (`oauth2.googleapis.com/token`), GA4 `runReport`, Shopify GraphQL **queries** (bodies containing `mutation` are refused) and the AI Secretary's question to Ollama (`ollama.com/api/chat`). Requests that carry a key never follow redirects. Everything else is blocked before a request is made. Never add code that posts, publishes, sends messages, changes prices or launches anything, and never call `fetch` directly (a test enforces this).
- Real data must **never be committed or pushed**: `/data/private/`, `/private/`, `.env*` (except `.env.example`), `*.docx`, `*.pem`, `*service-account*.json` and `*-key.json` are git-ignored, and `tests/no-private-data.test.ts` fails if a `.docx`, private path, `.env.local` or token-like secret is tracked.
- Tests, fixtures and screenshots committed to the repo use synthetic data only (`tests/fixtures/` is fictional and never imported by the app).
- AI answers from reports or channels only repeat what the source says (FACT) and use "Data not available." for anything it does not say.

## AI rules

- The AI Secretary uses Ollama (`OLLAMA_API_KEY`, default model `gemma4:cloud`) only for free-text questions; known questions use the rule-based tools. The model sees only the user's own data, and its reply is checked in code (`src/lib/ai/llmAnswer.ts`): every line labelled, FACT numbers must appear in the data, otherwise relabelled ESTIMATE. Without a key, or on any error, the rule-based answer is used and the gap is stated.
- **Never invent company information.** The user's entries, report files, connected channels and the brand rules in `src/data/brand.ts` are the only sources of truth.
- When information is unavailable, say exactly: **"Data not available."**
- Label every statement as one of: **FACT**, **ANALYSIS**, **ESTIMATE**, **RECOMMENDATION**, **DATA GAP**.
- Never present assumptions as facts.
- Never make high-risk business decisions automatically.
- The AI may prepare actions, drafts, recommendations and proposals. It must not execute external actions.
- **External actions require approval.** Actions that may need approval:
  - Publishing content
  - Sending external messages, customer emails or supplier emails
  - Changing product prices
  - Launching campaigns or changing promotions
  - Confirming commercial commitments
  - Communicating sensitive business information
- Even an approved action only updates its status. Nothing is sent, published, repriced or launched from this app.
- Do not provide tools that send, publish, reprice or launch.

## Content rules

- Follow Klong Phai Farm's brand tone and marketing rules in `src/data/brand.ts` (from the brand's own guide).
- Do not invent: product claims, certifications, awards, prices, product availability, customer information, or campaign results.
- If a needed fact is missing, state a DATA GAP instead of filling it in.

## Testing

Test:

- Core business logic
- AI tool selection
- Data loading (browser store, report files, channel adapters with recorded responses)
- Approval logic
- Invalid inputs, missing data, and error states
- Responsive layouts
- Accessibility
- TypeScript (type check)
- Production build

## Accessibility

- Keyboard accessible
- Good color contrast
- Clear labels
- Semantic HTML
- Responsive layout, usable on desktop and tablet

## Working agreement

- Do not build features until asked. Follow the user's current instruction only.
- Do not commit, push or open PRs unless asked.
- The user is a complete beginner: explain changes in simple language.
