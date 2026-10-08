// Checks the MOCK DATA in /mock: clearly labelled, fictional, internally consistent, and never used by the app.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const DIR = path.join(process.cwd(), "mock");
const FILES = ["company", "products", "tasks", "calendar", "meetings", "contacts", "customers", "b2b_accounts", "emails", "sales", "inventory", "purchases", "expenses", "marketing", "campaigns", "content", "events", "complaints", "pricing", "documents", "knowledge"];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const load = (name: string): any => JSON.parse(readFileSync(path.join(DIR, `${name}.json`), "utf8"));
const data = Object.fromEntries(FILES.map((f) => [f, load(f)]));

const ids = (list: { id?: string }[]) => new Set(list.map((x) => x.id));
const products = ids(data.products.products);
const customers = ids(data.customers.customers);
const contacts = ids(data.contacts.contacts);
const tasks = ids(data.tasks.tasks);
const campaigns = ids(data.campaigns.campaigns);
const complaints = ids(data.complaints.complaints);
const meetings = ids(data.meetings.meetings);
const emails = ids(data.emails.emails);
const events = ids(data.events.events);
const documents = ids(data.documents.documents);
const purchases = ids(data.purchases.purchases);
const content = ids(data.content.content);
const promotions = ids(data.pricing.promotions);
const orders = ids(data.sales.orders);
const known: Record<string, Set<string | undefined>> = {
  productId: products, customerId: customers, contactId: contacts, taskId: tasks, campaignId: campaigns, complaintId: complaints, meetingId: meetings, emailId: emails, eventId: events, documentId: documents, purchaseId: purchases, contentId: content, promotionId: promotions, orderId: orders,
};

/** Every "xxxId" / "xxxIds" field anywhere in a value, with the ids it points to. */
function references(value: unknown, out: [string, string][] = []): [string, string][] {
  if (Array.isArray(value)) value.forEach((v) => references(v, out));
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      const key = k.endsWith("Ids") ? `${k.slice(0, -3)}Id` : k;
      if (known[key] && typeof v === "string") out.push([key, v]);
      else if (known[key] && Array.isArray(v)) v.forEach((x) => typeof x === "string" && out.push([key, x]));
      else references(v, out);
    }
  }
  return out;
}

describe("mock data", () => {
  it("has all 21 datasets, each clearly labelled MOCK DATA", () => {
    expect(readdirSync(DIR).filter((f) => f.endsWith(".json")).sort()).toEqual(FILES.map((f) => `${f}.json`).sort());
    for (const f of FILES) {
      expect(data[f]._meta.dataLabel).toBe("MOCK DATA");
      expect(data[f]._meta.warning).toContain("fictional");
    }
  });

  it("marks every record as mock", () => {
    const lists = [data.products.products, data.tasks.tasks, data.customers.customers, data.b2b_accounts.accounts, data.contacts.contacts, data.emails.emails, data.sales.orders, data.inventory.inventory, data.complaints.complaints, data.campaigns.campaigns, data.content.content];
    for (const list of lists) for (const r of list) expect(r.mock).toBe(true);
  });

  it("uses only invented contact details: example domains and placeholder phone numbers", () => {
    const text = FILES.map((f) => JSON.stringify(data[f])).join("\n");
    const emailsFound = text.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) ?? [];
    expect(emailsFound.length).toBeGreaterThan(0);
    for (const e of emailsFound) expect(e).toMatch(/\.example$/);
    for (const phone of text.match(/\+66[-\d ]+/g) ?? []) expect(phone).toMatch(/^\+66-00-000-\d{4}/);
    expect(text).not.toMatch(/klong\s*phai|klongphai/i);
  });

  it("links every reference to a record that exists", () => {
    const broken = FILES.flatMap((f) => references(data[f]).filter(([key, id]) => !known[key].has(id)).map(([key, id]) => `${f}: ${key} ${id}`));
    expect(broken).toEqual([]);
  });

  it("keeps sales consistent: B2B and retail monthly rows are the sum of orders at list or promotion prices", () => {
    for (const o of data.sales.orders) {
      expect(o.totalThb).toBe(o.lines.reduce((s: number, l: { lineTotalThb: number }) => s + l.lineTotalThb, 0));
      for (const l of o.lines) expect(l.lineTotalThb).toBe(l.qty * l.unitPriceThb);
    }
    const delivered = data.sales.orders.filter((o: { status: string }) => !o.status.startsWith("Pre-order"));
    for (const row of data.sales.monthly.filter((r: { channel: string }) => !["Website", "LINE OA"].includes(r.channel))) {
      const fromOrders = delivered.filter((o: { date: string; channel: string }) => o.date.startsWith(row.month) && o.channel === row.channel).flatMap((o: { lines: { productId: string; qty: number }[] }) => o.lines).filter((l: { productId: string }) => l.productId === row.productId);
      expect(fromOrders.reduce((s: number, l: { qty: number }) => s + l.qty, 0)).toBe(row.units);
    }
  });

  it("demonstrates the required situations", () => {
    const t = data.tasks.tasks;
    const asOf = data.tasks._meta.asOf;
    expect(t.some((x: { urgent?: boolean }) => x.urgent)).toBe(true);
    expect(t.filter((x: { dueDate: string; status: string }) => x.dueDate < asOf && x.status !== "Done").length).toBeGreaterThanOrEqual(4);
    expect(t.filter((x: { type: string }) => x.type === "Follow-up").length).toBeGreaterThanOrEqual(4);
    expect(t.filter((x: { approval?: { state: string } }) => x.approval?.state === "Pending").length).toBeGreaterThanOrEqual(4);

    const statuses = new Set(data.inventory.inventory.map((i: { status: string }) => i.status));
    for (const s of ["Low stock", "Out of stock", "Slow-moving", "Upcoming shortage"]) expect(statuses).toContain(s);

    const channels = new Set(data.sales.monthly.map((r: { channel: string }) => r.channel));
    for (const c of ["Website", "LINE OA", "Retail", "Restaurant", "Hotel", "Wholesale", "Corporate"]) expect(channels).toContain(c);
    const changes = data.sales.byProduct.map((p: { unitsChangeSepVsAugPct: number | null }) => p.unitsChangeSepVsAugPct ?? 0);
    expect(Math.max(...changes)).toBeGreaterThan(10);
    expect(Math.min(...changes)).toBeLessThan(-10);

    const types = new Set(data.customers.customers.map((c: { type: string }) => c.type));
    for (const ty of ["Hotel", "Restaurant", "Chef", "Retail Partner", "Wholesale", "Corporate"]) expect(types).toContain(ty);

    const complaintTypes = new Set(data.complaints.complaints.map((c: { type: string }) => c.type));
    for (const ty of ["Delivery", "Packaging", "Product quality", "Product availability"]) expect(complaintTypes).toContain(ty);

    for (const k of ["website", "retail", "restaurant", "hotel", "b2b"]) expect(data.pricing.prices[0][k]).toBeGreaterThan(0);
    expect(data.pricing.promotions.length).toBeGreaterThan(0);
  });

  it("tells the promotion-vs-stock story consistently", () => {
    const breast = data.inventory.inventory.find((i: { productId: string }) => i.productId === "PRD-002");
    const pace = data.sales.byProduct.find((p: { productId: string }) => p.productId === "PRD-002");
    const campaign = data.campaigns.campaigns.find((c: { id: string }) => c.id === "CMP-001");
    expect(campaign.productIds).toContain("PRD-002");
    expect(breast.status).toBe("Low stock");
    expect(breast.daysOfCover).toBeLessThan(7);
    expect(pace.octoberPaceVsSepPct).toBeGreaterThan(50);
  });

  it("tells the lapsed-hotel story consistently", () => {
    const hotel = data.b2b_accounts.accounts.find((a: { customerId: string }) => a.customerId === "CUS-101");
    const task = data.tasks.tasks.find((x: { id: string }) => x.id === "TSK-002");
    expect(hotel.lastOrderDate).toBe("2026-07-28");
    expect(hotel.daysSinceLastOrder).toBeGreaterThan(60);
    expect(hotel.topProducts.map((p: { productId: string }) => p.productId)).toEqual(expect.arrayContaining(["PRD-008", "PRD-012"]));
    expect(task.dueDate < data.tasks._meta.asOf && task.status !== "Done").toBe(true);
  });

  it("is never imported by the app", () => {
    const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
    const offenders = walk(path.join(process.cwd(), "src")).filter((f) => /\.(ts|tsx)$/.test(f) && /["'](\.\.\/)+mock\/|["']@\/\.\.\/mock|mock\/[\w-]+\.json/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
