# MOCK DATA: Rai Thong Heritage Farm (fictional)

**Everything in this folder is MOCK DATA.** It describes an invented premium poultry and egg company in Thailand, built to look like the kind of business Klong Phai Farm runs. Its purpose is to demonstrate and test the AI Marketing Director Secretary.

- Every company, person, customer, email address (`.example` domains), phone number (`+66-00-000-…`) and figure is made up. Every file has `_meta.dataLabel = "MOCK DATA"`, and every record has `"mock": true`.
- No real customer information is used. No real or confidential Klong Phai Farm information is used.
- The app does **not** read this folder. The UI is unchanged and still shows only your own entries, reports and channels.
- "Today" in this mock world is **Wednesday 7 October 2026**. Sales cover 1 July to 6 October 2026.

Regenerate the files with `node mock/generate.mjs`. One script builds everything, so the files always agree: sales come from orders × prices, stock cover comes from sales, and ids link the files together. `tests/mock-data.test.ts` checks that every link resolves.

## Files

| File | What it holds |
| --- | --- |
| `company.json` | Company profile, farms, channels, team (contact ids) |
| `products.json` | 16 products with status and tags (top seller, declining, new, needs promotion, availability issues) |
| `pricing.json` | Per product: website, retail (to partners), retail shelf, restaurant, hotel, B2B, cost; plus promotion prices |
| `inventory.json` | Stock, reserved, available, shortfall, reorder point, daily sales, days of cover, next batch |
| `sales.json` | Highlights, totals, by channel, by product, monthly rows (month × channel × product) and every B2B/retail order |
| `customers.json` | B2C segments, hotels, restaurants, chefs, retail partners, wholesale, corporate (businesses only) |
| `b2b_accounts.json` | Account status, last order, days since, revenue, top products, opportunity, next step, follow-up date |
| `contacts.json` | Fictional internal team and business contacts (roles, not real people) |
| `tasks.json` | Urgent, overdue and upcoming tasks; follow-ups; pending approvals |
| `calendar.json` | Meetings, deadlines, follow-ups, events, campaign milestones, supply dates |
| `meetings.json` | Agenda, attendees, notes, action items |
| `emails.json` | Inbox, including unanswered emails |
| `campaigns.json` | Campaigns with products, budgets, KPIs, results, issues |
| `marketing.json` | Website, LINE OA, Facebook/Instagram and PR performance by month |
| `content.json` | Posts, broadcasts, press release, drafts awaiting approval |
| `events.json` | Expo, tastings, PR dinner, farm visit |
| `complaints.json` | Delivery, packaging, product and availability complaints, with follow-up and resolution |
| `purchases.json` | Purchase orders, including delayed and reduced supplies |
| `expenses.json` | Monthly marketing, logistics, packaging and feed costs |
| `documents.json` | Document list with summaries and links |
| `knowledge.json` | Policies and business rules (approvals, brand voice, delivery, stock-vs-promotion rule, follow-up rule) |

## Linked situations the AI should be able to find

1. **Promotion vs stock.**
   - Protein Week (`CMP-001`) promotes breast fillet `PRD-002` at 189 baht (`PROMO-001`).
   - The October sales pace is about double September's (`sales.json` byProduct). Website conversion rose to 3.1% (`marketing.json`).
   - Stock covers about 2 days (`inventory.json`), and the next batch only arrives on 12 Oct.
   - Production asks for a decision (`EML-002`), with an urgent task (`TSK-001`) and a meeting (`MTG-002`).
   - A second LINE broadcast is waiting for approval (`TSK-004` / `CNT-003`).
   - Late deliveries are already appearing (`CPL-002`, `CPL-006`).
2. **Lapsed hotel.**
   - Chao Phraya Lantern Hotel (`CUS-101`) last ordered on 28 Jul and regularly bought whole duck and native chicken (`b2b_accounts.json` topProducts, `sales.json` orders).
   - Its email asking for Q4 prices (`EML-004`) has gone unanswered, the follow-up `TSK-002` is overdue, and the Q4 hotel price list `TSK-005` / `DOC-002` is overdue too.
   - Whole duck supply drops by 30% in November (`PO-2026-0412`, `EML-007`).
3. **Duck breast out of stock.**
   - `PRD-009` has been out of stock since a supplier delay (`PO-2026-0409`).
   - Baan Krua Siam has complained (`CPL-001`, `EML-003`, `TSK-003`).
   - The farm-to-table dinner (`EVT-004`) and its press release (`CNT-010`, `TSK-017`) both need duck breast.
4. **Packaging issue at a retail partner.**
   - A lighter egg carton was introduced in September (`expenses.json` packaging).
   - Cracked eggs at Siam Fresh Gourmet followed (`CPL-003`, `EML-005`), and retail egg sales fell.
   - Open items: a quality meeting (`MTG-004`), an overdue reply (`TSK-010`), and a reinforced-carton order waiting for approval (`PO-2026-0418`).
5. **Declining products.**
   - Organic-feed eggs (`PRD-005`): a price gap and a cheaper competitor (`CPL-007`, `DOC-010`, `TSK-011`, draft `PROMO-004`), with slow-moving stock.
   - Smoked breast (`PRD-016`): a bundle idea (`CMP-005`, `PROMO-005`).
   - Duck eggs and salted eggs (`PRD-006`, `PRD-007`): a recipe idea (`TSK-015`).
6. **New products.**
   - Herb sausage (`PRD-011`) is growing on LINE OA.
   - Bone broth (`PRD-010`) is well below its 1,500-pouch target. Its launch price and posts are waiting for approval (`TSK-007`), with expo sampling planned (`EVT-001`).
7. **Festive gift box.**
   - 320 boxes are already pre-ordered (`CUS-152`), against 140 in stock, so there is a shortfall.
   - The packaging is delayed to 30 Oct (`PO-2026-0415`, `EML-006`).
   - The customer may want 200 more (`EML-010`), and the early-bird price needs approval (`TSK-009`).
8. **Wholesale price pressure.** Eastern Seaboard (`CUS-142`) is ordering less and asks for 115 baht wings (`EML-008`). The decision `TSK-012` is overdue. Pathum Fresh (`CUS-141`), by contrast, is growing.
9. **Short shelf life.** 90 pouches of liquid yolk (`PRD-014`) expire on 18 Oct (`TSK-018`).
