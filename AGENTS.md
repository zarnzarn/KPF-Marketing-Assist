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

- Prototype only. **Mock data only.**
- No production integrations, no real customer data, no real personal information.
- No database initially. No Supabase. No n8n. No external integrations (email, LINE OA, social, marketplaces, CRM, payments).
- No production deployment.
- Keep the architecture simple. Prefer simple solutions. Do not over-engineer.
- Do not create unnecessary abstractions.
- Use maintainable TypeScript and reusable components.
- Separation of concerns:
  - Business logic is separate from UI.
  - AI tools are separate from UI.
  - Mock data is separate from business logic.
- Make future integrations possible without rewriting the application (small interfaces at the data and AI boundaries, nothing more).
- Before implementing a major feature: explain what will be changed. Keep implementations modular.

## AI rules

- **Never invent company information.** Mock data (including the mock company knowledge base) is the source of truth.
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

- Follow Klong Phai Farm's brand tone and marketing rules from the mock company knowledge base.
- Do not invent: product claims, certifications, awards, prices, product availability, customer information, or campaign results.
- If a needed fact is missing, state a DATA GAP instead of filling it in.

## Testing

Test:

- Core business logic
- AI tool selection
- Mock data retrieval
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
