# AGENTS.md — AI Marketing Director Secretary

Instructions for any AI coding agent working in this repository.

## Project

- **Name:** AI Marketing Director Secretary
- **Company:** Klong Phai Farm (premium poultry and egg business, Thailand)
- **Phase:** Phase 1 Prototype
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

- Prototype only. **No mock data in the app.** Data comes only from:
  1. **The user's own entries** (tasks, meetings, customers, campaigns, content, issues, approvals, document names), stored **only in that browser** (`localStorage`).
  2. **The user's monthly marketing report files** (`.docx`), read from a local folder (see "Real data rules").
  3. **Read-only connections to the brand's own channels** (website, GA4, shop, Facebook, Instagram, LINE OA) through their official APIs, using credentials the user creates.
- When a source is empty or not connected, show an empty state and say "Data not available." Never fill gaps with sample or invented data.
- No real customer personal information: no private individuals' names, phone numbers or emails. Customer records are businesses or segments.
- No database. No Supabase. No n8n. No CRM, email, marketplace or payment integrations. No production deployment.
- Keep the architecture simple. Prefer simple solutions. Do not over-engineer. Do not create unnecessary abstractions.
- Use maintainable TypeScript and reusable components.
- Separation of concerns: business logic separate from UI; AI tools separate from UI; data loading (store, reports, channels) separate from business logic. Queries are pure functions of `AppData`.
- Before implementing a major feature: explain what will be changed. Keep implementations modular.

## Real data rules

- **Report files** are read at request time from `REPORTS_DIR` (in `.env.local`, default `data/private/reports`; sub-folders allowed). They are never copied into the repository.
- **Channel credentials** (tokens, keys, service-account files) live only in `.env.local` or files outside the repository. They are used only on the server, never sent to the browser, never written to logs or error messages.
- **Read-only:** all channel HTTP calls go through `src/lib/channels/readOnlyFetch.ts`. It allows GET, plus POST only to three read-only endpoints whose APIs require POST: Google sign-in (`oauth2.googleapis.com/token`), GA4 `runReport`, and Shopify GraphQL **queries** (bodies containing `mutation` are refused). Everything else is blocked before a request is made. Never add code that posts, publishes, sends messages, changes prices or launches anything, and never call `fetch` directly (a test enforces this).
- Real data must **never be committed or pushed**: `/data/private/`, `/private/`, `.env*` (except `.env.example`), `*.docx`, `*.pem`, `*service-account*.json` and `*-key.json` are git-ignored, and `tests/no-private-data.test.ts` fails if a `.docx`, private path, `.env.local` or token-like secret is tracked.
- Tests, fixtures and screenshots committed to the repo use synthetic data only (`tests/fixtures/` is fictional and never imported by the app).
- AI answers from reports or channels only repeat what the source says (FACT) and use "Data not available." for anything it does not say.

## AI rules

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
- In Phase 1, even an approved action only updates its status and audit log. Nothing is sent, published, repriced or launched.
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
