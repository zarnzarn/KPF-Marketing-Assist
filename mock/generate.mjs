// MOCK DATA generator for a fictional premium poultry and egg company in Thailand.
// Every name, number, email and phone number here is invented. Nothing is real customer
// or company information. Run:  node mock/generate.mjs   (writes the JSON files next to this script)
//
// The data is built in one place so that the datasets agree with each other: sales come from
// orders and prices, inventory cover comes from sales, tasks, emails, meetings, complaints and
// campaigns point at the same product and customer ids. See mock/README.md for the stories.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = dirname(fileURLToPath(import.meta.url));
const AS_OF = "2026-10-07"; // "today" in the mock world (Wednesday)
const COMPANY = "Rai Thong Heritage Farm Co., Ltd. (MOCK)";
const LABEL = "MOCK DATA";

// ---------- small helpers ----------
let seed = 20261007;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const between = (lo, hi) => Math.round(lo + rand() * (hi - lo));
const addDays = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const round = (n) => Math.round(n);
const pct = (a, b) => (b === 0 ? null : Math.round(((a - b) / b) * 1000) / 10);
const meta = (description, extra = {}) => ({ dataLabel: LABEL, company: COMPANY, asOf: AS_OF, currency: "THB", description, warning: "MOCK DATA: fictional company, people, customers and numbers. Not real business information.", ...extra });
const write = (name, body) => writeFileSync(join(OUT, name), `${JSON.stringify(body, null, 2)}\n`);
const mock = (rows) => rows.map((r) => ({ ...r, mock: true }));

// ---------- 1. company ----------
const company = {
  _meta: meta("Company profile of the fictional farm used for demos."),
  company: {
    legalName: COMPANY,
    brandName: "Rai Thong Farm (MOCK)",
    brandNameThai: "ไร่ทองฟาร์ม (ข้อมูลสมมติ)",
    founded: 2012,
    headquarters: "99/9 Moo 4, Tambon Example, Amphoe Sam Phran, Nakhon Pathom 73110 (MOCK address)",
    website: "https://www.raithongfarm.example",
    lineOa: "@raithongfarm-mock",
    facebook: "facebook.com/raithongfarm.mock",
    instagram: "@raithongfarm.mock",
    employees: 86,
    farms: [
      { id: "FARM-01", name: "Sam Phran free-range chicken farm (MOCK)", province: "Nakhon Pathom", capacity: "about 14,000 birds per cycle" },
      { id: "FARM-02", name: "Kanchanaburi layer farm (MOCK)", province: "Kanchanaburi", capacity: "about 22,000 laying hens" },
      { id: "FARM-03", name: "Partner duck farm: Suphan Duck Cooperative (MOCK)", province: "Suphan Buri", capacity: "contract supply, about 1,200 ducks per month" },
    ],
    coldStore: "Sam Phran cold store and packing house (MOCK)",
    deliveryZones: ["Bangkok and vicinity (own cold-chain trucks, next day)", "Hua Hin and Cha-am (twice a week)", "Eastern Seaboard (via wholesale partner)"],
    salesChannels: {
      B2C: ["Website shop", "LINE OA shop"],
      Retail: ["Premium supermarkets", "Gourmet grocery", "Organic markets"],
      B2B: ["Hotels", "Restaurants", "Chefs and cooking studios", "Wholesale", "Corporate catering and gifts"],
    },
    team: { marketingDirector: "CON-001", salesManagerB2B: "CON-002", productionManager: "CON-003", qaManager: "CON-004", customerService: "CON-005", contentLead: "CON-006", financeManager: "CON-007" },
    positioning: "Premium free-range poultry and eggs raised slowly on open farms in western Thailand (MOCK).",
    fiscalYear: "January to December",
  },
};

// ---------- 2. products + 19. pricing ----------
// prices: website (consumer, website and LINE OA), retail (price to retail partners), retailShelf (recommended shelf price),
// restaurant, hotel, b2b (wholesale and corporate), cost (production cost).
const P = (id, name, nameThai, category, unit, launch, status, price, tags, notes) => ({ id, name: `${name} (MOCK)`, nameThai, category, unit, launchDate: launch, status, price, tags, notes });
const productsList = [
  P("PRD-001", "Free-Range Whole Chicken 1.6 kg", "ไก่ฟรีเรนจ์ทั้งตัว 1.6 กก.", "Free-range chicken", "per bird", "2014-03-01", "Active", { cost: 205, website: 389, retail: 300, retailShelf: 369, restaurant: 315, hotel: 305, b2b: 285 }, ["top-seller"], "Best-selling product across all channels."),
  P("PRD-002", "Free-Range Chicken Breast Fillet 500 g", "อกไก่ฟรีเรนจ์ 500 ก.", "Free-range chicken", "per 500 g pack", "2015-06-01", "Active", { cost: 112, website: 219, retail: 165, retailShelf: 199, restaurant: 175, hotel: 170, b2b: 158 }, ["top-seller", "campaign", "low-stock"], "Promoted in Protein Week (CMP-001). Stock is low."),
  P("PRD-003", "Free-Range Boneless Thigh 500 g", "สะโพกไก่ไม่มีกระดูก 500 ก.", "Free-range chicken", "per 500 g pack", "2015-06-01", "Active", { cost: 96, website: 189, retail: 142, retailShelf: 175, restaurant: 150, hotel: 146, b2b: 136 }, [], "Steady seller."),
  P("PRD-004", "Free-Range Eggs 10 pcs (size 1)", "ไข่ไก่ฟรีเรนจ์ 10 ฟอง (เบอร์ 1)", "Eggs", "per 10-egg carton", "2013-01-15", "Active", { cost: 58, website: 119, retail: 84, retailShelf: 109, restaurant: 88, hotel: 86, b2b: 80 }, ["top-seller", "packaging-issue"], "Cracked-egg complaints from one retail partner after the carton change (CPL-003)."),
  P("PRD-005", "Organic-Feed Eggs 10 pcs", "ไข่ไก่อาหารออร์แกนิก 10 ฟอง", "Eggs", "per 10-egg carton", "2019-04-01", "Active", { cost: 82, website: 169, retail: 120, retailShelf: 155, restaurant: 126, hotel: 124, b2b: 115 }, ["declining", "needs-promotion"], "Sales falling for three months; price gap to competitors widened (pricing review TSK-011)."),
  P("PRD-006", "Duck Eggs 6 pcs", "ไข่เป็ด 6 ฟอง", "Eggs", "per 6-egg pack", "2017-02-01", "Active", { cost: 40, website: 85, retail: 58, retailShelf: 75, restaurant: 62, hotel: 60, b2b: 55 }, ["slow-moving"], "Slow-moving; stock building up."),
  P("PRD-007", "Salted Duck Eggs 4 pcs", "ไข่เค็ม 4 ฟอง", "Eggs", "per 4-egg pack", "2017-02-01", "Active", { cost: 38, website: 79, retail: 55, retailShelf: 69, restaurant: 58, hotel: 56, b2b: 52 }, ["declining"], "Declining since July."),
  P("PRD-008", "Whole Cherry Valley Duck 2.4 kg", "เป็ดเชอร์รี่วัลเลย์ทั้งตัว 2.4 กก.", "Duck", "per bird", "2018-09-01", "Active", { cost: 330, website: 590, retail: 455, retailShelf: 549, restaurant: 480, hotel: 465, b2b: 440 }, ["upcoming-availability-issue"], "Partner duck farm cut November supply by 30% (PO-2026-0412 delayed)."),
  P("PRD-009", "Duck Breast 2 pcs (about 600 g)", "อกเป็ด 2 ชิ้น (ประมาณ 600 ก.)", "Duck", "per 2-piece pack", "2018-09-01", "Active", { cost: 210, website: 399, retail: 299, retailShelf: 369, restaurant: 315, hotel: 305, b2b: 290 }, ["out-of-stock"], "Out of stock since 30 Sep; next lot expected 15 Oct (PO-2026-0409)."),
  P("PRD-010", "Chicken Bone Broth 500 ml (frozen)", "น้ำซุปกระดูกไก่ 500 มล. (แช่แข็ง)", "Ready-to-cook", "per 500 ml pouch", "2026-09-15", "Launching", { cost: 52, website: 149, retail: 105, retailShelf: 135, restaurant: 110, hotel: 108, b2b: 98 }, ["new", "needs-promotion"], "New product launched 15 Sep. Below launch target; launch content waiting for approval."),
  P("PRD-011", "Herb Chicken Sausage 300 g (frozen)", "ไส้กรอกไก่สมุนไพร 300 ก. (แช่แข็ง)", "Ready-to-cook", "per 300 g pack", "2026-08-01", "Active", { cost: 74, website: 159, retail: 112, retailShelf: 145, restaurant: 118, hotel: 115, b2b: 105 }, ["new"], "New in August; growing on LINE OA."),
  P("PRD-012", "Native Thai Chicken (Gai Baan) whole 1.2 kg", "ไก่บ้านทั้งตัว 1.2 กก.", "Free-range chicken", "per bird", "2016-01-10", "Active", { cost: 190, website: 349, retail: 270, retailShelf: 329, restaurant: 285, hotel: 275, b2b: 260 }, ["top-seller-b2b"], "Strong with hotels and chefs."),
  P("PRD-013", "Chicken Wings 1 kg (food-service)", "ปีกไก่ 1 กก. (ฟู้ดเซอร์วิส)", "Food-service", "per 1 kg bag", "2020-05-01", "Active", { cost: 98, website: 189, retail: 140, retailShelf: 175, restaurant: 135, hotel: 132, b2b: 125 }, [], "Mainly restaurants and wholesale."),
  P("PRD-014", "Liquid Egg Yolk 1 kg (food-service)", "ไข่แดงเหลว 1 กก. (ฟู้ดเซอร์วิส)", "Food-service", "per 1 kg pouch", "2021-03-01", "Active", { cost: 140, website: 0, retail: 0, retailShelf: 0, restaurant: 230, hotel: 225, b2b: 210 }, ["slow-moving"], "B2B only. Slow-moving; short shelf life (21 days)."),
  P("PRD-015", "Egg Gift Box 30 pcs (festive)", "กล่องของขวัญไข่ 30 ฟอง (เทศกาล)", "Gift", "per gift box", "2023-11-15", "Seasonal", { cost: 260, website: 590, retail: 430, retailShelf: 549, restaurant: 0, hotel: 0, b2b: 470 }, ["seasonal", "upcoming-availability-issue"], "For New Year gifts. Gift box packaging order delayed (PO-2026-0415); corporate pre-orders already in."),
  P("PRD-016", "Smoked Chicken Breast 200 g", "อกไก่รมควัน 200 ก.", "Ready-to-eat", "per 200 g pack", "2022-07-01", "Active", { cost: 62, website: 129, retail: 92, retailShelf: 119, restaurant: 98, hotel: 96, b2b: 88 }, ["declining", "needs-promotion"], "Declining; needs a new reason to buy."),
];
const product = (id) => productsList.find((p) => p.id === id);

// Promotions (promotion prices)
const promotions = [
  { id: "PROMO-001", productId: "PRD-002", campaignId: "CMP-001", channels: ["Website", "LINE OA"], promotionPrice: 189, from: "2026-10-01", to: "2026-10-15", type: "Price discount", approvalStatus: "Approved", note: "Protein Week: 219 to 189 baht." },
  { id: "PROMO-002", productId: "PRD-010", campaignId: "CMP-003", channels: ["Website", "LINE OA"], promotionPrice: 129, from: "2026-10-20", to: "2026-11-10", type: "Launch price", approvalStatus: "Pending approval", note: "Launch price for bone broth; waiting for Marketing Director approval (APR in TSK-007)." },
  { id: "PROMO-003", productId: "PRD-015", campaignId: "CMP-004", channels: ["Corporate", "Website"], promotionPrice: 520, from: "2026-11-01", to: "2026-12-20", type: "Early-bird corporate price (50+ boxes)", approvalStatus: "Pending approval", note: "Corporate early-bird gift box price; needs approval before quoting (TSK-009)." },
  { id: "PROMO-004", productId: "PRD-005", campaignId: null, channels: ["Retail"], promotionPrice: 139, from: "2026-11-01", to: "2026-11-30", type: "Proposed shelf price cut", approvalStatus: "Draft", note: "Proposed answer to declining organic eggs (TSK-011). Not approved." },
  { id: "PROMO-005", productId: "PRD-016", campaignId: "CMP-005", channels: ["Website", "LINE OA"], promotionPrice: 109, from: "2026-10-16", to: "2026-10-31", type: "Bundle with bone broth", approvalStatus: "Draft", note: "Idea: smoked breast + bone broth lunch bundle." },
];

// ---------- customers (customers.json) and b2b accounts ----------
const C = (id, name, type, segment, channel, city, extra = {}) => ({ id, name, type, segment, channel, city, ...extra });
const customersList = [
  C("CUS-001", "Website members, Bangkok families (segment)", "B2C Segment", "B2C", "Website", "Bangkok", { size: "about 4,100 active buyers in the last 90 days (MOCK)" }),
  C("CUS-002", "LINE OA shoppers (segment)", "B2C Segment", "B2C", "LINE OA", "Bangkok and vicinity", { size: "about 2,600 active buyers in the last 90 days (MOCK)" }),
  C("CUS-003", "Health-focused home cooks (segment)", "B2C Segment", "B2C", "Website", "Bangkok", { size: "about 900 buyers of breast, broth and organic eggs (MOCK)" }),
  C("CUS-101", "Chao Phraya Lantern Hotel (MOCK)", "Hotel", "B2B", "Hotel", "Bangkok"),
  C("CUS-102", "Sukhumvit Garden Residence Hotel (MOCK)", "Hotel", "B2B", "Hotel", "Bangkok"),
  C("CUS-103", "Hua Hin Seabreeze Resort (MOCK)", "Hotel", "B2B", "Hotel", "Prachuap Khiri Khan"),
  C("CUS-111", "Baan Krua Siam Restaurant (MOCK)", "Restaurant", "B2B", "Restaurant", "Bangkok"),
  C("CUS-112", "Ember & Rice Grill (MOCK)", "Restaurant", "B2B", "Restaurant", "Bangkok"),
  C("CUS-113", "Nong Lek Noodle Group, 6 branches (MOCK)", "Restaurant", "B2B", "Restaurant", "Bangkok"),
  C("CUS-121", "Chef's Table Private Dining (MOCK)", "Chef", "B2B", "Restaurant", "Bangkok"),
  C("CUS-122", "Saffron & Lemongrass Cooking Studio (MOCK)", "Chef", "B2B", "Restaurant", "Chiang Mai"),
  C("CUS-131", "Siam Fresh Gourmet, 8 branches (MOCK)", "Retail Partner", "Retail", "Retail", "Bangkok"),
  C("CUS-132", "Green Basket Organic Market (MOCK)", "Retail Partner", "Retail", "Retail", "Bangkok"),
  C("CUS-133", "Urban Pantry Delicatessen (MOCK)", "Retail Partner", "Retail", "Retail", "Bangkok"),
  C("CUS-141", "Pathum Fresh Wholesale (MOCK)", "Wholesale", "B2B", "Wholesale", "Pathum Thani"),
  C("CUS-142", "Eastern Seaboard Food Supply (MOCK)", "Wholesale", "B2B", "Wholesale", "Chonburi"),
  C("CUS-151", "Bangna Tech Park Canteen Services (MOCK)", "Corporate", "B2B", "Corporate", "Samut Prakan"),
  C("CUS-152", "Lumpini Finance Group, corporate gifts (MOCK)", "Corporate", "B2B", "Corporate", "Bangkok"),
];

// Order patterns for B2B and retail accounts. Each line: [productId, minQty, maxQty]. trend: multiplier per month (Jul, Aug, Sep, Oct).
const accounts = [
  { customerId: "CUS-101", every: 10, start: "2026-07-08", end: "2026-07-28", lines: [["PRD-008", 14, 18], ["PRD-004", 50, 60], ["PRD-012", 10, 14]], trend: [1, 1, 1, 1] }, // lapsed after 28 Jul
  { customerId: "CUS-102", every: 7, start: "2026-07-03", lines: [["PRD-012", 8, 10], ["PRD-004", 30, 36], ["PRD-014", 4, 6]], trend: [1, 1.1, 1.25, 1.35] },
  { customerId: "CUS-103", every: 7, start: "2026-07-06", lines: [["PRD-001", 12, 16], ["PRD-004", 40, 50], ["PRD-002", 15, 20]], trend: [0.9, 0.9, 1.1, 1.4] },
  { customerId: "CUS-111", every: 5, start: "2026-07-01", lines: [["PRD-009", 10, 14], ["PRD-002", 10, 14], ["PRD-008", 3, 5]], trend: [1, 1, 1, 0.6], skipProductFrom: { "PRD-009": "2026-09-30" } },
  { customerId: "CUS-113", every: 4, start: "2026-07-02", lines: [["PRD-013", 25, 30], ["PRD-003", 14, 18]], trend: [1, 1.15, 1.3, 1.4] },
  { customerId: "CUS-121", every: 14, start: "2026-07-08", lines: [["PRD-008", 4, 6], ["PRD-012", 4, 6], ["PRD-009", 4, 6]], trend: [1, 1, 1, 1], skipProductFrom: { "PRD-009": "2026-09-30" } },
  { customerId: "CUS-122", every: 21, start: "2026-07-10", lines: [["PRD-001", 6, 8], ["PRD-004", 12, 16]], trend: [1, 1, 1, 1] },
  { customerId: "CUS-131", every: 3, start: "2026-07-01", lines: [["PRD-004", 120, 140], ["PRD-002", 40, 50], ["PRD-001", 25, 30], ["PRD-016", 12, 16], ["PRD-007", 15, 20]], trend: [1, 1, 0.82, 0.7], lineTrend: { "PRD-016": [1, 0.85, 0.7, 0.65], "PRD-007": [1, 0.85, 0.75, 0.7] } },
  { customerId: "CUS-132", every: 4, start: "2026-07-01", lines: [["PRD-005", 60, 70], ["PRD-006", 15, 20], ["PRD-003", 12, 16]], trend: [1, 1, 1, 1], lineTrend: { "PRD-005": [1, 0.82, 0.68, 0.6], "PRD-006": [1, 0.9, 0.8, 0.7] } },
  { customerId: "CUS-133", every: 7, start: "2026-07-04", lines: [["PRD-016", 10, 14], ["PRD-011", 8, 12], ["PRD-010", 0, 0]], trend: [1, 1, 1, 1], lineTrend: { "PRD-016": [1, 0.9, 0.75, 0.7], "PRD-011": [0, 1, 1.4, 1.6] }, extraFrom: { "PRD-010": ["2026-09-15", 6, 8] } },
  { customerId: "CUS-141", every: 7, start: "2026-07-03", lines: [["PRD-013", 80, 100], ["PRD-004", 150, 180], ["PRD-003", 40, 50]], trend: [1, 1.1, 1.2, 1.3] },
  { customerId: "CUS-142", every: 10, start: "2026-07-05", lines: [["PRD-013", 60, 70], ["PRD-001", 30, 40]], trend: [1, 0.85, 0.7, 0.65] },
  { customerId: "CUS-151", every: 7, start: "2026-07-07", lines: [["PRD-003", 30, 40], ["PRD-004", 40, 50]], trend: [1, 1, 1, 1] },
  { customerId: "CUS-152", every: 999, start: "2026-09-25", lines: [["PRD-015", 0, 0]], trend: [1, 1, 1, 1] },
];
const channelOf = (customerId) => customersList.find((c) => c.id === customerId).channel;
const priceFor = (p, channel, date) => {
  const promo = promotions.find((x) => x.productId === p.id && x.approvalStatus === "Approved" && x.channels.includes(channel) && date >= x.from && date <= x.to);
  if (promo) return promo.promotionPrice;
  const key = { Website: "website", "LINE OA": "website", Retail: "retail", Restaurant: "restaurant", Hotel: "hotel", Wholesale: "b2b", Corporate: "b2b" }[channel];
  return p.price[key];
};
const monthIndex = (date) => ({ "2026-07": 0, "2026-08": 1, "2026-09": 2, "2026-10": 3 })[date.slice(0, 7)];

const orders = [];
let orderNo = 1;
for (const a of accounts) {
  const end = a.end ?? "2026-10-06";
  for (let d = a.start; d <= end; d = addDays(d, a.every)) {
    const channel = channelOf(a.customerId);
    const m = monthIndex(d);
    const lines = [];
    for (const [pid, lo, hi] of a.lines) {
      const extra = a.extraFrom?.[pid];
      let qty = between(lo, hi);
      if (extra) qty = d >= extra[0] ? between(extra[1], extra[2]) : 0;
      if (a.skipProductFrom?.[pid] && d >= a.skipProductFrom[pid]) qty = 0;
      qty = round(qty * a.trend[m] * (a.lineTrend?.[pid]?.[m] ?? 1));
      if (qty <= 0) continue;
      const unitPrice = priceFor(product(pid), channel, d);
      lines.push({ productId: pid, qty, unitPriceThb: unitPrice, lineTotalThb: qty * unitPrice });
    }
    if (lines.length === 0) continue;
    orders.push({ id: `ORD-${String(orderNo++).padStart(4, "0")}`, customerId: a.customerId, channel, date: d, lines, totalThb: lines.reduce((s, l) => s + l.lineTotalThb, 0), status: "Delivered" });
  }
}
// Corporate gift pre-orders (not yet delivered)
const preorder = { id: `ORD-${String(orderNo++).padStart(4, "0")}`, customerId: "CUS-152", channel: "Corporate", date: "2026-09-29", lines: [{ productId: "PRD-015", qty: 320, unitPriceThb: 470, lineTotalThb: 320 * 470 }], totalThb: 320 * 470, status: "Pre-order, delivery 15 Dec", deliveryDate: "2026-12-15" };
orders.push(preorder);
// One open order affected by the duck breast stock-out
const affected = orders.filter((o) => o.customerId === "CUS-111").at(-1);
affected.status = "Delivered without duck breast (out of stock)";

// B2C (website and LINE OA) monthly units. Oct = 1-6 Oct only.
const b2c = {
  "PRD-001": { Website: [610, 625, 640, 140], "LINE OA": [380, 390, 400, 88] },
  "PRD-002": { Website: [820, 860, 900, 420], "LINE OA": [450, 470, 490, 230] }, // Protein Week from 1 Oct
  "PRD-003": { Website: [420, 430, 425, 86], "LINE OA": [260, 250, 255, 52] },
  "PRD-004": { Website: [1500, 1540, 1580, 330], "LINE OA": [980, 1000, 1020, 210] },
  "PRD-005": { Website: [700, 610, 520, 92], "LINE OA": [380, 330, 280, 50] },
  "PRD-006": { Website: [160, 150, 140, 24], "LINE OA": [90, 85, 80, 13] },
  "PRD-007": { Website: [240, 210, 180, 30], "LINE OA": [150, 130, 110, 18] },
  "PRD-008": { Website: [140, 150, 165, 36], "LINE OA": [60, 66, 72, 16] },
  "PRD-009": { Website: [180, 190, 175, 0], "LINE OA": [70, 75, 70, 0] },
  "PRD-010": { Website: [0, 0, 120, 30], "LINE OA": [0, 0, 70, 16] },
  "PRD-011": { Website: [0, 140, 210, 52], "LINE OA": [0, 120, 230, 60] },
  "PRD-012": { Website: [210, 215, 220, 44], "LINE OA": [120, 118, 122, 25] },
  "PRD-013": { Website: [90, 95, 92, 18], "LINE OA": [40, 42, 41, 8] },
  "PRD-015": { Website: [0, 0, 12, 9], "LINE OA": [0, 0, 0, 0] },
  "PRD-016": { Website: [360, 320, 270, 46], "LINE OA": [180, 160, 130, 22] },
};

const MONTHS = ["2026-07", "2026-08", "2026-09", "2026-10"];
const monthly = [];
for (const [pid, channels] of Object.entries(b2c)) {
  for (const [channel, units] of Object.entries(channels)) {
    units.forEach((u, i) => {
      if (u === 0) return;
      const p = product(pid);
      // Website/LINE revenue: promo price applies to the promo window (Oct 1-6 for PRD-002)
      const unitPrice = priceFor(p, channel, i === 3 ? "2026-10-03" : `${MONTHS[i]}-15`);
      monthly.push({ month: MONTHS[i], channel, productId: pid, units: u, revenueThb: u * unitPrice });
    });
  }
}
for (const o of orders.filter((x) => x.status !== "Pre-order, delivery 15 Dec")) {
  for (const l of o.lines) {
    const month = o.date.slice(0, 7);
    let row = monthly.find((r) => r.month === month && r.channel === o.channel && r.productId === l.productId);
    if (!row) monthly.push((row = { month, channel: o.channel, productId: l.productId, units: 0, revenueThb: 0 }));
    row.units += l.qty;
    row.revenueThb += l.lineTotalThb;
  }
}
monthly.sort((a, b) => a.month.localeCompare(b.month) || a.channel.localeCompare(b.channel) || a.productId.localeCompare(b.productId));

const sum = (rows, f) => rows.reduce((s, r) => s + f(r), 0);
const CHANNELS = ["Website", "LINE OA", "Retail", "Restaurant", "Hotel", "Wholesale", "Corporate"];
const byChannel = CHANNELS.map((channel) => {
  const m = MONTHS.map((month) => sum(monthly.filter((r) => r.month === month && r.channel === channel), (r) => r.revenueThb));
  return { channel, revenueThb: { "2026-07": m[0], "2026-08": m[1], "2026-09": m[2], "2026-10 (1-6 Oct)": m[3] }, changeSepVsAugPct: pct(m[2], m[1]) };
});
const byProduct = productsList.map((p) => {
  const u = MONTHS.map((month) => sum(monthly.filter((r) => r.month === month && r.productId === p.id), (r) => r.units));
  const r = MONTHS.map((month) => sum(monthly.filter((x) => x.month === month && x.productId === p.id), (x) => x.revenueThb));
  // Oct run-rate: 6 days scaled to a 30-day month, to compare with September.
  const octPace = round((u[3] / 6) * 30);
  return { productId: p.id, name: p.name, units: { "2026-07": u[0], "2026-08": u[1], "2026-09": u[2], "2026-10 (1-6 Oct)": u[3] }, revenueThb: { "2026-07": r[0], "2026-08": r[1], "2026-09": r[2], "2026-10 (1-6 Oct)": r[3] }, unitsChangeSepVsAugPct: pct(u[2], u[1]), octoberPaceUnitsPer30Days: octPace, octoberPaceVsSepPct: pct(octPace, u[2]) };
});
const totalByMonth = MONTHS.map((month) => sum(monthly.filter((r) => r.month === month), (r) => r.revenueThb));

// ---------- 11. inventory ----------
const pp0 = (pid) => byProduct.find((p) => p.productId === pid);
const dailyAvg = (pid) => {
  const row = byProduct.find((x) => x.productId === pid);
  return Math.round(((row.units["2026-09"] / 30) * 0.5 + (row.units["2026-10 (1-6 Oct)"] / 6) * 0.5) * 10) / 10;
};
const INV = (pid, onHand, reserved, reorderPoint, nextBatch, notes, override) => {
  const avg = dailyAvg(pid);
  const free = onHand - reserved;
  const available = Math.max(free, 0);
  // Reserved stock above what is on hand is a shortfall: orders already promised that cannot be filled yet.
  const shortfall = free < 0 ? -free : 0;
  const daysOfCover = avg > 0 ? Math.round((available / avg) * 10) / 10 : null;
  let status = available <= 0 ? "Out of stock" : available <= reorderPoint ? "Low stock" : "In stock";
  if (override) status = override;
  return { productId: pid, name: product(pid).name, location: "Sam Phran cold store (MOCK)", onHand, reserved, available, shortfall, reorderPoint, dailyAvgSales: avg, daysOfCover, status, nextBatch, notes };
};
const inventory = [
  INV("PRD-001", 1450, 220, 600, { date: "2026-10-09", qty: 1800, source: "FARM-01 processing" }, "Healthy."),
  INV("PRD-002", 260, 80, 400, { date: "2026-10-12", qty: 900, source: "FARM-01 processing" }, `Protein Week (CMP-001) demand is about ${(1 + pp0("PRD-002").octoberPaceVsSepPct / 100).toFixed(1)}x the September pace. At the current pace the stock runs out around 9-10 Oct, before the next batch on 12 Oct. Production can add 600 packs only if the 19 Oct slaughter slot moves earlier (see email EML-002, meeting MTG-002).`),
  INV("PRD-003", 980, 120, 400, { date: "2026-10-09", qty: 900, source: "FARM-01 processing" }, "Healthy."),
  INV("PRD-004", 6200, 900, 2500, { date: "2026-10-08", qty: 7000, source: "FARM-02 daily collection" }, "Healthy volume. New lighter carton since 1 Sep linked to cracked eggs at CUS-131 (CPL-003)."),
  INV("PRD-005", 2100, 60, 800, { date: "2026-10-08", qty: 1200, source: "FARM-02 organic flock" }, "Slow sell-through; eggs older than 14 days rising. Risk of waste.", "Slow-moving"),
  INV("PRD-006", 1150, 0, 300, { date: "2026-10-14", qty: 600, source: "FARM-03 partner" }, "About 70 days of cover. Slow-moving.", "Slow-moving"),
  INV("PRD-007", 640, 30, 200, { date: "2026-10-20", qty: 400, source: "FARM-03 partner (salting 21 days)" }, "Declining demand."),
  INV("PRD-008", 210, 40, 120, { date: "2026-10-16", qty: 260, source: "FARM-03 partner duck farm" }, "November supply cut by 30% by the partner farm (PO-2026-0412). Hotels' December banquet season at risk. Upcoming availability issue.", "Upcoming shortage"),
  INV("PRD-009", 0, 0, 80, { date: "2026-10-15", qty: 180, source: "FARM-03 partner duck farm (PO-2026-0409, delayed from 2 Oct)" }, "Out of stock since 30 Sep. Restaurants affected (CUS-111, CUS-121)."),
  INV("PRD-010", 1900, 40, 300, { date: "2026-10-28", qty: 1200, source: "Co-packer: Western Kitchen Foods (MOCK)" }, "Plenty of stock; sales below launch plan (plan: 1,500 pouches in the first month)."),
  INV("PRD-011", 520, 60, 250, { date: "2026-10-10", qty: 700, source: "Co-packer: Western Kitchen Foods (MOCK)" }, "Growing on LINE OA."),
  INV("PRD-012", 380, 60, 150, { date: "2026-10-13", qty: 400, source: "FARM-01 native flock" }, "Healthy."),
  INV("PRD-013", 1650, 300, 600, { date: "2026-10-09", qty: 1200, source: "FARM-01 processing" }, "Healthy; wholesale demand rising."),
  INV("PRD-014", 210, 10, 60, { date: "2026-10-21", qty: 120, source: "FARM-02 egg breaking line" }, "Slow-moving. 21-day shelf life: 90 pouches expire on 18 Oct.", "Slow-moving"),
  INV("PRD-015", 140, 320, 200, { date: "2026-11-20", qty: 1500, source: "Packing house; needs gift boxes from PO-2026-0415" }, "Corporate pre-order of 320 boxes (CUS-152) already exceeds stock. Gift box packaging order delayed. Upcoming availability issue for the New Year campaign (CMP-004).", "Upcoming shortage"),
  INV("PRD-016", 1300, 30, 300, { date: "2026-10-15", qty: 500, source: "Co-packer: Western Kitchen Foods (MOCK)" }, "Sales falling; about 60 days of cover. Best-before 45 days.", "Slow-moving"),
];

// ---------- contacts ----------
const contacts = mock([
  { id: "CON-001", name: "Nattaya Srisuk (MOCK)", nickname: "Khun Ploy", role: "Marketing Director", organization: COMPANY, internal: true, email: "marketing.director@raithongfarm.example", phone: "+66-00-000-0001 (MOCK)" },
  { id: "CON-002", name: "Krit Wongsa (MOCK)", nickname: "Khun Krit", role: "B2B Sales Manager", organization: COMPANY, internal: true, email: "b2b.sales@raithongfarm.example", phone: "+66-00-000-0002 (MOCK)" },
  { id: "CON-003", name: "Somchai Boonmee (MOCK)", nickname: "Khun Chai", role: "Production Manager", organization: COMPANY, internal: true, email: "production@raithongfarm.example", phone: "+66-00-000-0003 (MOCK)" },
  { id: "CON-004", name: "Pimchanok Rattana (MOCK)", nickname: "Khun Pim", role: "QA and Packaging Manager", organization: COMPANY, internal: true, email: "qa@raithongfarm.example", phone: "+66-00-000-0004 (MOCK)" },
  { id: "CON-005", name: "Waraporn Chaiyo (MOCK)", nickname: "Khun Wan", role: "Customer Service Lead", organization: COMPANY, internal: true, email: "care@raithongfarm.example", phone: "+66-00-000-0005 (MOCK)" },
  { id: "CON-006", name: "Thanakorn Mee (MOCK)", nickname: "Khun Ton", role: "Content and Social Media Lead", organization: COMPANY, internal: true, email: "content@raithongfarm.example", phone: "+66-00-000-0006 (MOCK)" },
  { id: "CON-007", name: "Sirilak Phan (MOCK)", nickname: "Khun Lak", role: "Finance Manager", organization: COMPANY, internal: true, email: "finance@raithongfarm.example", phone: "+66-00-000-0007 (MOCK)" },
  { id: "CON-101", name: "F&B Purchasing Manager (MOCK contact)", role: "F&B Purchasing", organization: "Chao Phraya Lantern Hotel (MOCK)", customerId: "CUS-101", internal: false, email: "purchasing@lantern-hotel.example", phone: "+66-00-000-0101 (MOCK)" },
  { id: "CON-102", name: "Executive Chef (MOCK contact)", role: "Executive Chef", organization: "Sukhumvit Garden Residence Hotel (MOCK)", customerId: "CUS-102", internal: false, email: "chef@sgr-hotel.example", phone: "+66-00-000-0102 (MOCK)" },
  { id: "CON-103", name: "Purchasing Officer (MOCK contact)", role: "Purchasing", organization: "Hua Hin Seabreeze Resort (MOCK)", customerId: "CUS-103", internal: false, email: "buying@seabreeze.example", phone: "+66-00-000-0103 (MOCK)" },
  { id: "CON-111", name: "Head Chef (MOCK contact)", role: "Head Chef", organization: "Baan Krua Siam Restaurant (MOCK)", customerId: "CUS-111", internal: false, email: "kitchen@baankruasiam.example", phone: "+66-00-000-0111 (MOCK)" },
  { id: "CON-112", name: "Owner (MOCK contact)", role: "Owner", organization: "Ember & Rice Grill (MOCK)", customerId: "CUS-112", internal: false, email: "hello@emberandrice.example", phone: "+66-00-000-0112 (MOCK)" },
  { id: "CON-113", name: "Central Kitchen Manager (MOCK contact)", role: "Central Kitchen", organization: "Nong Lek Noodle Group (MOCK)", customerId: "CUS-113", internal: false, email: "ck@nonglek.example", phone: "+66-00-000-0113 (MOCK)" },
  { id: "CON-121", name: "Chef-Owner (MOCK contact)", role: "Chef-Owner", organization: "Chef's Table Private Dining (MOCK)", customerId: "CUS-121", internal: false, email: "table@chefstable.example", phone: "+66-00-000-0121 (MOCK)" },
  { id: "CON-122", name: "Studio Manager (MOCK contact)", role: "Studio Manager", organization: "Saffron & Lemongrass Cooking Studio (MOCK)", customerId: "CUS-122", internal: false, email: "studio@saffronlemongrass.example", phone: "+66-00-000-0122 (MOCK)" },
  { id: "CON-131", name: "Category Buyer, Fresh (MOCK contact)", role: "Category Buyer", organization: "Siam Fresh Gourmet (MOCK)", customerId: "CUS-131", internal: false, email: "fresh.buyer@siamfresh.example", phone: "+66-00-000-0131 (MOCK)" },
  { id: "CON-132", name: "Buyer (MOCK contact)", role: "Buyer", organization: "Green Basket Organic Market (MOCK)", customerId: "CUS-132", internal: false, email: "buyer@greenbasket.example", phone: "+66-00-000-0132 (MOCK)" },
  { id: "CON-133", name: "Store Manager (MOCK contact)", role: "Store Manager", organization: "Urban Pantry Delicatessen (MOCK)", customerId: "CUS-133", internal: false, email: "store@urbanpantry.example", phone: "+66-00-000-0133 (MOCK)" },
  { id: "CON-141", name: "Purchasing Manager (MOCK contact)", role: "Purchasing", organization: "Pathum Fresh Wholesale (MOCK)", customerId: "CUS-141", internal: false, email: "po@pathumfresh.example", phone: "+66-00-000-0141 (MOCK)" },
  { id: "CON-142", name: "Procurement Lead (MOCK contact)", role: "Procurement", organization: "Eastern Seaboard Food Supply (MOCK)", customerId: "CUS-142", internal: false, email: "procurement@esfs.example", phone: "+66-00-000-0142 (MOCK)" },
  { id: "CON-151", name: "Catering Manager (MOCK contact)", role: "Catering", organization: "Bangna Tech Park Canteen Services (MOCK)", customerId: "CUS-151", internal: false, email: "catering@bangnatech.example", phone: "+66-00-000-0151 (MOCK)" },
  { id: "CON-152", name: "Corporate Affairs Officer (MOCK contact)", role: "Corporate gifts", organization: "Lumpini Finance Group (MOCK)", customerId: "CUS-152", internal: false, email: "gifts@lumpinifinance.example", phone: "+66-00-000-0152 (MOCK)" },
  { id: "CON-201", name: "Supply Coordinator (MOCK contact)", role: "Duck supply", organization: "Suphan Duck Cooperative (MOCK)", supplier: true, internal: false, email: "supply@suphanduck.example", phone: "+66-00-000-0201 (MOCK)" },
  { id: "CON-202", name: "Account Manager (MOCK contact)", role: "Packaging sales", organization: "Bangkok Box & Print (MOCK)", supplier: true, internal: false, email: "sales@bkkboxprint.example", phone: "+66-00-000-0202 (MOCK)" },
  { id: "CON-203", name: "Production Planner (MOCK contact)", role: "Co-packing", organization: "Western Kitchen Foods (MOCK)", supplier: true, internal: false, email: "planning@westernkitchen.example", phone: "+66-00-000-0203 (MOCK)" },
  { id: "CON-204", name: "Event Coordinator (MOCK contact)", role: "Exhibitor services", organization: "Bangkok Gourmet Expo (MOCK)", internal: false, email: "exhibitors@bkkgourmetexpo.example", phone: "+66-00-000-0204 (MOCK)" },
  { id: "CON-205", name: "Food Editor (MOCK contact)", role: "Editor", organization: "Krua Living Magazine (MOCK)", internal: false, email: "editor@krualiving.example", phone: "+66-00-000-0205 (MOCK)" },
]);

// ---------- b2b accounts ----------
const lastOrder = (cid) => orders.filter((o) => o.customerId === cid && o.status !== "Pre-order, delivery 15 Dec").map((o) => o.date).sort().at(-1) ?? null;
const ordersOf = (cid) => orders.filter((o) => o.customerId === cid);
const revenue90 = (cid) => sum(ordersOf(cid).filter((o) => o.date >= "2026-07-08" && o.status !== "Pre-order, delivery 15 Dec"), (o) => o.totalThb);
const topProducts = (cid) => {
  const tally = {};
  for (const o of ordersOf(cid)) for (const l of o.lines) tally[l.productId] = (tally[l.productId] ?? 0) + l.qty;
  return Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([productId, units]) => ({ productId, units }));
};
const B = (customerId, extra) => {
  const lo = lastOrder(customerId);
  return { customerId, name: customersList.find((c) => c.id === customerId).name, type: customersList.find((c) => c.id === customerId).type, accountManager: "CON-002", primaryContact: contacts.find((c) => c.customerId === customerId)?.id ?? null, lastOrderDate: lo, daysSinceLastOrder: lo ? Math.round((Date.parse(AS_OF) - Date.parse(lo)) / 86400000) : null, ordersSince1Jul: ordersOf(customerId).length, revenueLast90DaysThb: revenue90(customerId), topProducts: topProducts(customerId), ...extra };
};
const b2bAccounts = mock([
  B("CUS-101", { status: "At risk", paymentTerms: "Credit 30 days", priceList: "hotel", orderFrequency: "Every 10 days until 28 Jul, none since", opportunity: "Win back before December banquet season; previously bought whole duck (PRD-008) and native chicken (PRD-012).", nextStep: "Overdue follow-up call (TSK-002, due 25 Sep). They emailed asking for Q4 hotel prices on 22 Sep (EML-004), still unanswered.", followUpDate: "2026-09-25", risk: "Whole duck supply is tight in November (PRD-008), so any offer must check stock first." }),
  B("CUS-102", { status: "Active account", paymentTerms: "Credit 30 days", priceList: "hotel", orderFrequency: "Weekly", opportunity: "Growing: +25% since July. Executive chef wants a Christmas duck menu tasting (EVT-003).", nextStep: "Tasting on 21 Oct.", followUpDate: "2026-10-21" }),
  B("CUS-103", { status: "Active account", paymentTerms: "Credit 30 days", priceList: "hotel", orderFrequency: "Weekly", opportunity: "High season from November; orders already up in October.", nextStep: "Confirm November volumes (TSK-014).", followUpDate: "2026-10-10" }),
  B("CUS-111", { status: "At risk", paymentTerms: "Credit 15 days", priceList: "restaurant", orderFrequency: "Every 5 days", opportunity: "Loyal restaurant; duck breast is their signature dish.", nextStep: "Complaint CPL-001 about duck breast out of stock. Offer whole duck (PRD-008) as a bridge until 15 Oct.", followUpDate: "2026-10-08" }),
  B("CUS-112", { status: "Proposal sent", paymentTerms: "To be agreed", priceList: "restaurant", orderFrequency: "No orders yet", opportunity: "New grill restaurant: wings, thigh and native chicken. Proposal sent 26 Sep.", nextStep: "Follow up on the proposal (TSK-006, due 3 Oct, overdue).", followUpDate: "2026-10-03" }),
  B("CUS-113", { status: "Active account", paymentTerms: "Credit 30 days", priceList: "restaurant", orderFrequency: "Every 4 days", opportunity: "Opening 2 more branches in November; wings volume +40%.", nextStep: "Annual supply agreement draft (DOC-008).", followUpDate: "2026-10-15" }),
  B("CUS-121", { status: "Active account", paymentTerms: "Cash on delivery", priceList: "restaurant", orderFrequency: "Every 2 weeks", opportunity: "Chef collaboration for a farm-to-table dinner (EVT-004).", nextStep: "Duck breast missing for the 18 Oct dinner unless PO-2026-0409 arrives on time.", followUpDate: "2026-10-09" }),
  B("CUS-122", { status: "Active account", paymentTerms: "Transfer before delivery", priceList: "restaurant", orderFrequency: "Every 3 weeks", opportunity: "Cooking classes could feature bone broth (PRD-010).", nextStep: "Send bone broth samples (TSK-016).", followUpDate: "2026-10-14" }),
  B("CUS-131", { status: "Active account", paymentTerms: "Credit 45 days", priceList: "retail", orderFrequency: "Every 3 days", opportunity: "Largest retail partner, but egg orders down about 20% since the cracked-egg issue.", nextStep: "Joint quality review on 9 Oct (MTG-004); answer complaint CPL-003.", followUpDate: "2026-10-09" }),
  B("CUS-132", { status: "Active account", paymentTerms: "Credit 30 days", priceList: "retail", orderFrequency: "Every 4 days", opportunity: "Organic eggs falling; buyer says shoppers switch to a cheaper organic brand.", nextStep: "Pricing review for PRD-005 (TSK-011).", followUpDate: "2026-10-12" }),
  B("CUS-133", { status: "Active account", paymentTerms: "Credit 30 days", priceList: "retail", orderFrequency: "Weekly", opportunity: "Good shelf for new ready-to-cook items (PRD-010, PRD-011).", nextStep: "Tasting stand for bone broth on weekends (CMP-003).", followUpDate: "2026-10-17" }),
  B("CUS-141", { status: "Active account", paymentTerms: "Credit 30 days", priceList: "b2b", orderFrequency: "Weekly", opportunity: "Volume up 30% since July.", nextStep: "Quarterly review in November.", followUpDate: "2026-11-05" }),
  B("CUS-142", { status: "At risk", paymentTerms: "Credit 30 days", priceList: "b2b", orderFrequency: "Every 10 days", opportunity: "Orders down 35% since July; they asked for a lower wings price.", nextStep: "Decide on price request (TSK-012) and call back.", followUpDate: "2026-10-06" }),
  B("CUS-151", { status: "Active account", paymentTerms: "Credit 30 days", priceList: "b2b", orderFrequency: "Weekly", opportunity: "Stable canteen supply.", nextStep: "Contract renewal in January.", followUpDate: "2026-12-01" }),
  B("CUS-152", { status: "Active account", paymentTerms: "50% deposit, balance on delivery", priceList: "b2b", orderFrequency: "Seasonal (New Year gifts)", opportunity: "Pre-ordered 320 egg gift boxes for 15 Dec; may add 200 more.", nextStep: "Confirm gift box supply before accepting more (PO-2026-0415, TSK-009).", followUpDate: "2026-10-13" }),
]);
const customers = mock(customersList.map((c) => {
  const acc = b2bAccounts.find((a) => a.customerId === c.id);
  return acc ? { ...c, status: acc.status, lastOrderDate: acc.lastOrderDate, b2bAccount: true } : { ...c, status: "Active", b2bAccount: false };
}));

// ---------- tasks ----------
const T = (id, title, priority, status, dueDate, owner, type, related, extra = {}) => ({ id, title, priority, status, dueDate, owner, type, related, ...extra });
const tasks = mock([
  T("TSK-001", "Coordinate with production: breast fillet stock will run out before the 12 Oct batch", "High", "In progress", "2026-10-08", "CON-001", "Task", { productId: "PRD-002", campaignId: "CMP-001", emailId: "EML-002", meetingId: "MTG-002" }, { urgent: true, note: "Decide: pull the 19 Oct slot forward, or limit the promo to LINE OA / pause ads." }),
  T("TSK-002", "Follow up Chao Phraya Lantern Hotel: no orders since 28 Jul", "High", "To do", "2026-09-25", "CON-002", "Follow-up", { customerId: "CUS-101", emailId: "EML-004", productIds: ["PRD-008", "PRD-012"] }, { note: "They asked for Q4 hotel prices on 22 Sep. Previously bought whole duck and native chicken." }),
  T("TSK-003", "Reply to Baan Krua Siam about duck breast out of stock", "High", "To do", "2026-10-07", "CON-005", "Follow-up", { customerId: "CUS-111", complaintId: "CPL-001", productId: "PRD-009" }, { urgent: true }),
  T("TSK-004", "Approve LINE OA broadcast: Protein Week second wave", "High", "Waiting for approval", "2026-10-08", "CON-001", "Approval", { campaignId: "CMP-001", contentId: "CNT-003" }, { approval: { actionType: "Send external message", requestedBy: "CON-006", requestedAt: "2026-10-06", state: "Pending" }, note: "Check stock first: the broadcast could push breast fillet demand higher (TSK-001)." }),
  T("TSK-005", "Prepare Q4 hotel price list", "Medium", "In progress", "2026-10-03", "CON-002", "Task", { documentId: "DOC-002", customerIds: ["CUS-101", "CUS-102", "CUS-103"] }, { note: "Overdue; needed to answer CUS-101." }),
  T("TSK-006", "Follow up Ember & Rice Grill proposal", "Medium", "To do", "2026-10-03", "CON-002", "Follow-up", { customerId: "CUS-112", documentId: "DOC-007" }),
  T("TSK-007", "Approve bone broth launch price and launch posts", "High", "Waiting for approval", "2026-10-10", "CON-001", "Approval", { productId: "PRD-010", campaignId: "CMP-003", promotionId: "PROMO-002", contentIds: ["CNT-005", "CNT-006"] }, { approval: { actionType: "Change promotion", requestedBy: "CON-006", requestedAt: "2026-10-03", state: "Pending" } }),
  T("TSK-008", "Book booth design and samples for Bangkok Gourmet Expo", "Medium", "In progress", "2026-10-15", "CON-006", "Task", { eventId: "EVT-001", productIds: ["PRD-010", "PRD-011", "PRD-012"] }),
  T("TSK-009", "Approve corporate gift box early-bird price", "High", "Waiting for approval", "2026-10-13", "CON-001", "Approval", { productId: "PRD-015", promotionId: "PROMO-003", customerId: "CUS-152", purchaseId: "PO-2026-0415" }, { approval: { actionType: "Change product price", requestedBy: "CON-002", requestedAt: "2026-10-05", state: "Pending" }, note: "Gift box packaging is delayed; confirm supply before quoting more boxes." }),
  T("TSK-010", "Answer cracked-egg complaint from Siam Fresh Gourmet", "High", "In progress", "2026-10-06", "CON-004", "Follow-up", { customerId: "CUS-131", complaintId: "CPL-003", productId: "PRD-004" }, { note: "Overdue. QA test of the new carton due 8 Oct." }),
  T("TSK-011", "Pricing review: organic-feed eggs losing to cheaper brand", "Medium", "To do", "2026-10-12", "CON-001", "Task", { productId: "PRD-005", customerId: "CUS-132", promotionId: "PROMO-004", documentId: "DOC-010" }),
  T("TSK-012", "Decide on Eastern Seaboard wings price request", "Medium", "To do", "2026-10-06", "CON-002", "Approval", { customerId: "CUS-142", productId: "PRD-013" }, { approval: { actionType: "Confirm commercial commitment", requestedBy: "CON-002", requestedAt: "2026-10-01", state: "Pending" }, note: "Asked for 115 instead of 125 baht per kg. Overdue." }),
  T("TSK-013", "Monthly marketing report for September", "Medium", "Done", "2026-10-05", "CON-001", "Task", { documentId: "DOC-001" }),
  T("TSK-014", "Confirm November volumes with Hua Hin Seabreeze Resort", "Medium", "To do", "2026-10-10", "CON-002", "Follow-up", { customerId: "CUS-103" }),
  T("TSK-015", "Move slow duck eggs: idea for a salted-egg recipe post", "Low", "To do", "2026-10-18", "CON-006", "Task", { productIds: ["PRD-006", "PRD-007"], contentId: "CNT-009" }),
  T("TSK-016", "Send bone broth samples to cooking studio", "Low", "To do", "2026-10-14", "CON-002", "Follow-up", { customerId: "CUS-122", productId: "PRD-010" }),
  T("TSK-017", "Approve press release: farm-to-table dinner", "Medium", "Waiting for approval", "2026-10-11", "CON-001", "Approval", { eventId: "EVT-004", contentId: "CNT-010", customerId: "CUS-121" }, { approval: { actionType: "Publish content", requestedBy: "CON-006", requestedAt: "2026-10-06", state: "Pending" }, note: "Mentions duck breast on the menu, which is out of stock until 15 Oct." }),
  T("TSK-018", "Use or discount liquid yolk expiring 18 Oct", "Medium", "To do", "2026-10-12", "CON-002", "Task", { productId: "PRD-014", customerIds: ["CUS-102", "CUS-113"] }),
  T("TSK-019", "Check website delivery delays (two late Bangkok orders)", "Medium", "In progress", "2026-10-09", "CON-005", "Task", { complaintIds: ["CPL-002", "CPL-006"] }),
  T("TSK-020", "Plan New Year gift box campaign with stock limits", "Medium", "To do", "2026-10-20", "CON-001", "Task", { campaignId: "CMP-004", productId: "PRD-015", purchaseId: "PO-2026-0415" }),
]);

// ---------- meetings ----------
const meetings = mock([
  { id: "MTG-001", title: "Weekly marketing stand-up", date: "2026-10-07", start: "09:30", end: "10:00", location: "Head office meeting room (MOCK)", attendees: ["CON-001", "CON-006", "CON-005"], agenda: ["Protein Week results so far (CMP-001)", "Bone broth launch approval (TSK-007)", "Expo booth (EVT-001)"], notes: "", related: { campaignIds: ["CMP-001", "CMP-003"] } },
  { id: "MTG-002", title: "Breast fillet supply for Protein Week (with production)", date: "2026-10-08", start: "10:30", end: "11:15", location: "Online (MOCK)", attendees: ["CON-001", "CON-003", "CON-002"], agenda: ["Stock runs out around 9-10 Oct (inventory PRD-002)", "Option: move 19 Oct slaughter slot to 10 Oct (+600 packs)", "Option: pause ads, keep LINE OA only", "Hotel and retail allocations"], notes: "", previousDiscussion: "On 30 Sep production warned the promo could exceed capacity (EML-001).", related: { productId: "PRD-002", campaignId: "CMP-001", taskId: "TSK-001", emailId: "EML-002" } },
  { id: "MTG-003", title: "Lantern Hotel win-back call", date: "2026-10-09", start: "14:00", end: "14:30", location: "Phone (MOCK)", attendees: ["CON-002", "CON-101"], agenda: ["Q4 hotel prices (DOC-002)", "December banquet needs: whole duck and native chicken", "Why orders stopped after July"], notes: "", related: { customerId: "CUS-101", taskId: "TSK-002" } },
  { id: "MTG-004", title: "Quality review with Siam Fresh Gourmet", date: "2026-10-09", start: "10:00", end: "11:00", location: "Siam Fresh Gourmet head office (MOCK)", attendees: ["CON-001", "CON-004", "CON-131"], agenda: ["Cracked eggs since the new carton (CPL-003)", "Credit for damaged packs", "Plan to win back egg volume"], notes: "", related: { customerId: "CUS-131", complaintId: "CPL-003", productId: "PRD-004" } },
  { id: "MTG-005", title: "New Year gift box planning", date: "2026-10-13", start: "15:00", end: "16:00", location: "Head office (MOCK)", attendees: ["CON-001", "CON-002", "CON-003", "CON-007"], agenda: ["Gift box packaging delay (PO-2026-0415)", "Corporate pre-orders vs capacity", "Early-bird price approval (TSK-009)"], notes: "", related: { productId: "PRD-015", campaignId: "CMP-004" } },
  { id: "MTG-006", title: "September marketing review", date: "2026-10-02", start: "13:00", end: "14:30", location: "Head office (MOCK)", attendees: ["CON-001", "CON-006", "CON-002", "CON-007"], agenda: ["September sales by channel", "Declining products: organic eggs, smoked breast, salted eggs", "Q4 campaign plan"], notes: "Agreed to launch Protein Week on 1 Oct and to review organic egg pricing. Smoked breast to be bundled with bone broth (idea).", actionItems: [{ text: "Pricing review for organic eggs", owner: "CON-001", due: "2026-10-12", taskId: "TSK-011" }, { text: "Bundle idea for smoked breast", owner: "CON-006", due: "2026-10-14" }], related: { documentId: "DOC-001" } },
]);

// ---------- calendar ----------
const calendar = mock([
  ...meetings.map((m) => ({ id: `CAL-${m.id}`, date: m.date, start: m.start, end: m.end, type: "Meeting", title: m.title, refId: m.id })),
  ...tasks.filter((t) => t.status !== "Done").map((t) => ({ id: `CAL-${t.id}`, date: t.dueDate, type: t.type === "Follow-up" ? "Follow-up" : t.type === "Approval" ? "Approval deadline" : "Task deadline", title: t.title, refId: t.id, overdue: t.dueDate < AS_OF })),
  { id: "CAL-EVT-001", date: "2026-10-25", endDate: "2026-10-27", type: "Event", title: "Bangkok Gourmet Expo booth (MOCK)", refId: "EVT-001" },
  { id: "CAL-EVT-003", date: "2026-10-21", start: "15:00", end: "17:00", type: "Event", title: "Christmas duck menu tasting at Sukhumvit Garden Residence (MOCK)", refId: "EVT-003" },
  { id: "CAL-EVT-004", date: "2026-10-18", start: "18:30", end: "22:00", type: "Event", title: "Farm-to-table dinner with Chef's Table (MOCK)", refId: "EVT-004" },
  { id: "CAL-CMP-001-END", date: "2026-10-15", type: "Campaign milestone", title: "Protein Week ends", refId: "CMP-001" },
  { id: "CAL-CMP-003-START", date: "2026-10-20", type: "Campaign milestone", title: "Bone broth launch campaign starts", refId: "CMP-003" },
  { id: "CAL-PO-0409", date: "2026-10-15", type: "Supply", title: "Duck breast delivery expected (PO-2026-0409)", refId: "PO-2026-0409" },
  { id: "CAL-PO-0415", date: "2026-10-30", type: "Supply", title: "Gift box packaging delivery (delayed from 10 Oct)", refId: "PO-2026-0415" },
  { id: "CAL-PRD-002-BATCH", date: "2026-10-12", type: "Supply", title: "Breast fillet batch: 900 packs", refId: "PRD-002" },
]).sort((a, b) => a.date.localeCompare(b.date));

// ---------- emails ----------
const emails = mock([
  { id: "EML-001", receivedAt: "2026-09-30T16:20:00+07:00", from: "CON-003", to: ["CON-001"], subject: "Protein Week: breast fillet capacity", body: "Khun Ploy, for the 1-15 Oct promo we can supply about 900 extra packs on 12 Oct. If demand doubles we will run short before that batch. Please share the ad budget plan so we can plan the line. (MOCK)", related: { productId: "PRD-002", campaignId: "CMP-001" }, needsReply: false, repliedAt: "2026-10-01T09:05:00+07:00" },
  { id: "EML-002", receivedAt: "2026-10-06T17:45:00+07:00", from: "CON-003", to: ["CON-001", "CON-002"], subject: "URGENT: breast fillet stock 260 packs", body: "Breast fillet stock is down to 260 packs (180 free after reservations). At this week's pace we are out by Thursday or Friday. I can move the 19 Oct slaughter slot to 10 Oct for +600 packs, but then we have fewer whole birds for hotels next week. Need a decision by tomorrow noon. (MOCK)", related: { productId: "PRD-002", campaignId: "CMP-001", taskId: "TSK-001" }, needsReply: true, priority: "High" },
  { id: "EML-003", receivedAt: "2026-10-05T11:10:00+07:00", from: "CON-111", to: ["CON-005"], subject: "Duck breast again out of stock?", body: "This is the second week without duck breast. It is our signature dish. When can you deliver, and what can you offer meanwhile? (MOCK)", related: { customerId: "CUS-111", complaintId: "CPL-001", productId: "PRD-009" }, needsReply: true, priority: "High" },
  { id: "EML-004", receivedAt: "2026-09-22T10:30:00+07:00", from: "CON-101", to: ["CON-002"], subject: "Q4 prices for whole duck and native chicken", body: "Hello, we are planning December banquets. Please send your Q4 hotel prices for whole duck and native chicken, and confirm you can supply about 60 ducks per week in December. (MOCK)", related: { customerId: "CUS-101", productIds: ["PRD-008", "PRD-012"], taskId: "TSK-002" }, needsReply: true, priority: "High", note: "Unanswered for 15 days." },
  { id: "EML-005", receivedAt: "2026-10-04T14:00:00+07:00", from: "CON-131", to: ["CON-001", "CON-004"], subject: "Cracked eggs in 3 branches", body: "We removed 46 cartons of free-range eggs this week because of cracks. Customers complain the new carton feels thinner. We have reduced the order until this is fixed. (MOCK)", related: { customerId: "CUS-131", complaintId: "CPL-003", productId: "PRD-004" }, needsReply: true, priority: "High" },
  { id: "EML-006", receivedAt: "2026-10-03T09:15:00+07:00", from: "CON-202", to: ["CON-003", "CON-001"], subject: "Gift box delivery delayed to 30 Oct", body: "Due to a paper shortage, your 1,500 gift boxes will arrive on 30 Oct instead of 10 Oct. (MOCK)", related: { purchaseId: "PO-2026-0415", productId: "PRD-015" }, needsReply: true },
  { id: "EML-007", receivedAt: "2026-10-02T16:40:00+07:00", from: "CON-201", to: ["CON-003"], subject: "November duck supply reduced", body: "Because of flooding at two member farms, we can supply only 70% of the agreed November volume of whole ducks. Duck breast lot moves from 2 Oct to 15 Oct. (MOCK)", related: { purchaseIds: ["PO-2026-0409", "PO-2026-0412"], productIds: ["PRD-008", "PRD-009"] }, needsReply: false },
  { id: "EML-008", receivedAt: "2026-10-01T13:00:00+07:00", from: "CON-142", to: ["CON-002"], subject: "Wings price for Q4", body: "A competitor offers wings at 115 baht per kg. Can you match? Otherwise we will reduce our order. (MOCK)", related: { customerId: "CUS-142", productId: "PRD-013", taskId: "TSK-012" }, needsReply: true },
  { id: "EML-009", receivedAt: "2026-10-06T10:05:00+07:00", from: "CON-205", to: ["CON-001"], subject: "Feature on farm-to-table dinner", body: "We would like to feature your dinner with Chef's Table in our November issue. Can you send photos and the menu by 12 Oct? (MOCK)", related: { eventId: "EVT-004", customerId: "CUS-121" }, needsReply: true },
  { id: "EML-010", receivedAt: "2026-10-06T08:30:00+07:00", from: "CON-152", to: ["CON-002"], subject: "Possible 200 more gift boxes", body: "Our board may add 200 boxes to the order. Please confirm price and delivery by 15 Oct. (MOCK)", related: { customerId: "CUS-152", productId: "PRD-015" }, needsReply: true },
]);

// ---------- purchases ----------
const purchases = mock([
  { id: "PO-2026-0409", supplier: "Suphan Duck Cooperative (MOCK)", supplierContact: "CON-201", item: "Duck breast, 180 packs", productId: "PRD-009", orderedAt: "2026-09-15", expectedAt: "2026-10-15", originalExpectedAt: "2026-10-02", amountThb: 180 * 165, status: "Delayed", note: "Delay caused the duck breast stock-out." },
  { id: "PO-2026-0412", supplier: "Suphan Duck Cooperative (MOCK)", supplierContact: "CON-201", item: "Whole ducks for November, 1,000 birds (cut to 700)", productId: "PRD-008", orderedAt: "2026-09-20", expectedAt: "2026-11-01", amountThb: 700 * 280, status: "Reduced by supplier", note: "Only 70% of volume confirmed." },
  { id: "PO-2026-0415", supplier: "Bangkok Box & Print (MOCK)", supplierContact: "CON-202", item: "Festive egg gift boxes, 1,500 pcs", productId: "PRD-015", orderedAt: "2026-09-12", expectedAt: "2026-10-30", originalExpectedAt: "2026-10-10", amountThb: 1500 * 38, status: "Delayed" },
  { id: "PO-2026-0418", supplier: "Bangkok Box & Print (MOCK)", supplierContact: "CON-202", item: "Egg cartons 10 pcs, reinforced version, 20,000 pcs", productId: "PRD-004", orderedAt: "2026-10-06", expectedAt: "2026-10-20", amountThb: 20000 * 4, status: "Waiting for approval", note: "QA proposes going back to the thicker carton (CPL-003)." },
  { id: "PO-2026-0420", supplier: "Western Kitchen Foods (MOCK)", supplierContact: "CON-203", item: "Bone broth co-packing, 1,200 pouches", productId: "PRD-010", orderedAt: "2026-10-01", expectedAt: "2026-10-28", amountThb: 1200 * 38, status: "Confirmed" },
  { id: "PO-2026-0421", supplier: "Thai Feed Mill (MOCK)", item: "Layer feed, 40 tonnes", orderedAt: "2026-10-02", expectedAt: "2026-10-09", amountThb: 40 * 14500, status: "Confirmed" },
  { id: "PO-2026-0422", supplier: "Organic Grain Co-op (MOCK)", item: "Certified organic layer feed, 12 tonnes", orderedAt: "2026-09-25", expectedAt: "2026-10-08", amountThb: 12 * 23800, status: "Confirmed", note: "Feed cost up 9% vs Q2, one reason for the organic egg price gap." },
]);

// ---------- expenses ----------
const expenses = mock([
  ...["2026-07", "2026-08", "2026-09"].flatMap((m, i) => [
    { month: m, category: "Marketing: digital ads", amountThb: [95000, 98000, 110000][i] },
    { month: m, category: "Marketing: content production", amountThb: [42000, 45000, 60000][i] },
    { month: m, category: "Marketing: LINE OA messaging", amountThb: [18000, 18000, 22000][i] },
    { month: m, category: "Marketing: PR and events", amountThb: [25000, 15000, 40000][i] },
    { month: m, category: "Logistics: cold-chain delivery", amountThb: [310000, 318000, 326000][i] },
    { month: m, category: "Packaging", amountThb: [148000, 150000, 139000][i], note: i === 2 ? "Lighter egg carton from September (cheaper, see CPL-003)." : undefined },
    { month: m, category: "Feed", amountThb: [1820000, 1850000, 1910000][i] },
  ]),
  { month: "2026-10", category: "Marketing: digital ads", amountThb: 48000, note: "Month to date (1-6 Oct), mostly Protein Week (CMP-001)." },
  { month: "2026-10", category: "Marketing: content production", amountThb: 18000, note: "Month to date." },
]);

// ---------- campaigns ----------
const unitsIn = (pid, month, channels) => sum(monthly.filter((r) => r.productId === pid && r.month === month && channels.includes(r.channel)), (r) => r.units);
const campaigns = mock([
  { id: "CMP-001", name: "Protein Week (MOCK)", objective: "Grow breast fillet sales with health-focused home cooks", productIds: ["PRD-002"], channels: ["Website", "LINE OA", "Facebook", "Instagram"], targetAudience: "Health-focused home cooks in Bangkok (CUS-003)", startDate: "2026-10-01", endDate: "2026-10-15", status: "Active", budgetThb: 120000, spentThb: 52000, approvalStatus: "Approved", contentStatus: "Published", promotionId: "PROMO-001", kpis: { target: "2,400 packs on website + LINE OA in 15 days", actualSoFar: `${unitsIn("PRD-002", "2026-10", ["Website", "LINE OA"])} packs in 6 days`, websiteConversionRate: "3.1% (September: 2.2%)", lineClickRate: "11.4%" }, issue: "Demand is ahead of supply: stock runs out before the 12 Oct batch (INV PRD-002, TSK-001).", milestones: [{ date: "2026-10-08", label: "Second-wave LINE broadcast (needs approval TSK-004)" }, { date: "2026-10-15", label: "Campaign ends" }] },
  { id: "CMP-002", name: "Farm Fresh Eggs Every Morning (MOCK)", objective: "Keep egg subscribers buying weekly", productIds: ["PRD-004", "PRD-005"], channels: ["LINE OA", "Website"], targetAudience: "Families", startDate: "2026-08-01", endDate: "2026-09-30", status: "Completed", budgetThb: 60000, spentThb: 58500, approvalStatus: "Approved", contentStatus: "Published", kpis: { target: "+10% egg units", result: `Free-range eggs website+LINE: ${pct(unitsIn("PRD-004", "2026-09", ["Website", "LINE OA"]), unitsIn("PRD-004", "2026-07", ["Website", "LINE OA"]))}% Jul to Sep; organic eggs: ${pct(unitsIn("PRD-005", "2026-09", ["Website", "LINE OA"]), unitsIn("PRD-005", "2026-07", ["Website", "LINE OA"]))}%` }, learning: "Free-range eggs held up; organic eggs kept falling despite the campaign." },
  { id: "CMP-003", name: "Bone Broth Launch (MOCK)", objective: "Reach 1,500 pouches a month for the new bone broth", productIds: ["PRD-010"], channels: ["Website", "LINE OA", "Instagram", "Retail tasting"], targetAudience: "Busy home cooks, health-focused families", startDate: "2026-10-20", endDate: "2026-11-20", status: "Planned", budgetThb: 150000, spentThb: 0, approvalStatus: "Pending approval", contentStatus: "In progress", promotionId: "PROMO-002", kpis: { target: "1,500 pouches per month", currentRunRate: `${byProduct.find((p) => p.productId === "PRD-010").octoberPaceUnitsPer30Days} pouches per 30 days (October pace)` }, milestones: [{ date: "2026-10-10", label: "Approve price and posts (TSK-007)" }, { date: "2026-10-25", label: "Sampling at Bangkok Gourmet Expo (EVT-001)" }] },
  { id: "CMP-004", name: "New Year Gift Box (MOCK)", objective: "Sell 1,500 egg gift boxes to companies and families", productIds: ["PRD-015"], channels: ["Corporate sales", "Website", "LINE OA"], targetAudience: "Corporate HR and admin teams, families", startDate: "2026-11-01", endDate: "2026-12-20", status: "Planned", budgetThb: 90000, spentThb: 0, approvalStatus: "Not required", contentStatus: "Not started", promotionId: "PROMO-003", issue: "Gift box packaging arrives 30 Oct, not 10 Oct (PO-2026-0415). 320 boxes already pre-ordered by CUS-152." },
  { id: "CMP-005", name: "Smart Lunch Bundle (MOCK)", objective: "Give smoked breast a new reason to buy by pairing it with bone broth", productIds: ["PRD-016", "PRD-010"], channels: ["Website", "LINE OA"], targetAudience: "Office workers", startDate: "2026-10-16", endDate: "2026-10-31", status: "Draft", budgetThb: 40000, spentThb: 0, approvalStatus: "Not required", contentStatus: "Not started", promotionId: "PROMO-005" },
  { id: "CMP-006", name: "Chef Partnership: Farm-to-Table Dinner (MOCK)", objective: "PR and B2B credibility with chefs", productIds: ["PRD-008", "PRD-009", "PRD-012"], channels: ["PR", "Instagram", "Event"], targetAudience: "Food media, chefs, hotel F&B", startDate: "2026-10-18", endDate: "2026-11-15", status: "Planned", budgetThb: 70000, spentThb: 12000, approvalStatus: "Pending approval", contentStatus: "In progress", issue: "Duck breast is on the menu but out of stock until 15 Oct (PRD-009)." },
]);

// ---------- marketing (channel performance) ----------
const marketing = {
  _meta: meta("Monthly marketing channel performance. October = 1-6 Oct only."),
  website: [
    { month: "2026-07", sessions: 48200, orders: 1050, conversionRatePct: 2.2, revenueThb: sum(monthly.filter((r) => r.month === "2026-07" && r.channel === "Website"), (r) => r.revenueThb), topLandingPage: "/shop/eggs" },
    { month: "2026-08", sessions: 50100, orders: 1090, conversionRatePct: 2.2, revenueThb: sum(monthly.filter((r) => r.month === "2026-08" && r.channel === "Website"), (r) => r.revenueThb), topLandingPage: "/shop/eggs" },
    { month: "2026-09", sessions: 51800, orders: 1140, conversionRatePct: 2.2, revenueThb: sum(monthly.filter((r) => r.month === "2026-09" && r.channel === "Website"), (r) => r.revenueThb), topLandingPage: "/recipes/chicken-breast" },
    { month: "2026-10", partial: "1-6 Oct", sessions: 14900, orders: 462, conversionRatePct: 3.1, revenueThb: sum(monthly.filter((r) => r.month === "2026-10" && r.channel === "Website"), (r) => r.revenueThb), topLandingPage: "/promo/protein-week" },
  ],
  lineOa: [
    { month: "2026-07", friends: 18400, blocked: 410, broadcasts: 4, avgOpenRatePct: 52, avgClickRatePct: 7.8 },
    { month: "2026-08", friends: 19100, blocked: 430, broadcasts: 5, avgOpenRatePct: 50, avgClickRatePct: 7.2 },
    { month: "2026-09", friends: 19900, blocked: 520, broadcasts: 6, avgOpenRatePct: 47, avgClickRatePct: 6.9, note: "More blocks after 6 broadcasts in one month." },
    { month: "2026-10", partial: "1-6 Oct", friends: 20300, blocked: 95, broadcasts: 2, avgOpenRatePct: 55, avgClickRatePct: 11.4, note: "Protein Week broadcast performed well." },
  ],
  social: [
    { month: "2026-07", facebookFollowers: 41200, facebookEngagementRatePct: 2.1, instagramFollowers: 15800, instagramEngagementRatePct: 3.4, topPost: "Morning egg collection reel" },
    { month: "2026-08", facebookFollowers: 41600, facebookEngagementRatePct: 2.0, instagramFollowers: 16300, instagramEngagementRatePct: 3.6, topPost: "Herb sausage launch carousel" },
    { month: "2026-09", facebookFollowers: 42000, facebookEngagementRatePct: 1.8, instagramFollowers: 16900, instagramEngagementRatePct: 3.9, topPost: "Bone broth 'slow simmer' video" },
    { month: "2026-10", partial: "1-6 Oct", facebookFollowers: 42150, facebookEngagementRatePct: 2.6, instagramFollowers: 17100, instagramEngagementRatePct: 4.2, topPost: "Protein Week recipe carousel" },
  ],
  pr: [
    { date: "2026-08-20", outlet: "Krua Living Magazine (MOCK)", type: "Feature", topic: "Slow-raised chickens in Nakhon Pathom", reach: "about 80,000 readers (MOCK)" },
    { date: "2026-09-18", outlet: "Bangkok Food Weekly online (MOCK)", type: "News", topic: "Bone broth launch", reach: "about 35,000 page views (MOCK)" },
    { date: "2026-10-06", outlet: "Krua Living Magazine (MOCK)", type: "Request", topic: "Farm-to-table dinner feature for November issue (EML-009)", reach: "pending" },
  ],
  insights: [
    "Website conversion rose from 2.2% to 3.1% during Protein Week (CMP-001).",
    "LINE OA blocks rose in September after six broadcasts; keep to four or five a month.",
    "Organic-feed eggs fell on every channel for three months (PRD-005).",
    "Herb sausage (PRD-011) grows mainly through LINE OA.",
  ],
};

// ---------- content ----------
const content = mock([
  { id: "CNT-001", title: "Protein Week launch carousel", platform: "Instagram", campaignId: "CMP-001", productId: "PRD-002", status: "Published", approvalStatus: "Approved", publishDate: "2026-10-01", results: { reach: 28400, saves: 1210 } },
  { id: "CNT-002", title: "Protein Week LINE broadcast 1", platform: "LINE OA", campaignId: "CMP-001", productId: "PRD-002", status: "Published", approvalStatus: "Approved", publishDate: "2026-10-01", results: { opens: 11200, clicks: 2310 } },
  { id: "CNT-003", title: "Protein Week LINE broadcast 2 (last days)", platform: "LINE OA", campaignId: "CMP-001", productId: "PRD-002", status: "In review", approvalStatus: "Pending approval", dueDate: "2026-10-08", draftText: "Protein Week ends 15 Oct. Free-range breast fillet, raised slowly on open pasture, now 189 baht. Order on LINE today. (MOCK draft)", note: "May need to change or pause if stock runs out (TSK-001)." },
  { id: "CNT-004", title: "5 quick breast fillet dinners (blog)", platform: "Website", campaignId: "CMP-001", productId: "PRD-002", status: "Published", approvalStatus: "Not required", publishDate: "2026-10-02" },
  { id: "CNT-005", title: "Bone broth launch video", platform: "Instagram", campaignId: "CMP-003", productId: "PRD-010", status: "In review", approvalStatus: "Pending approval", dueDate: "2026-10-10", draftText: "Twelve hours of slow simmering, bones from our own free-range chickens. Warm, simple, ready in five minutes. (MOCK draft)" },
  { id: "CNT-006", title: "Bone broth launch LINE broadcast", platform: "LINE OA", campaignId: "CMP-003", productId: "PRD-010", status: "Draft", approvalStatus: "Pending approval", dueDate: "2026-10-18", draftText: "New: chicken bone broth from Rai Thong Farm. Launch price 129 baht until 10 Nov. (MOCK draft)" },
  { id: "CNT-007", title: "Why our eggs come in a new carton", platform: "Facebook", campaignId: null, productId: "PRD-004", status: "Idea", approvalStatus: "Not required", dueDate: "2026-10-12", note: "Wait for QA answer on CPL-003 before posting." },
  { id: "CNT-008", title: "New Year gift box product photos", platform: "Website", campaignId: "CMP-004", productId: "PRD-015", status: "Idea", approvalStatus: "Not required", dueDate: "2026-10-25" },
  { id: "CNT-009", title: "Salted egg fried rice recipe", platform: "Facebook", campaignId: null, productIds: ["PRD-006", "PRD-007"], status: "Idea", approvalStatus: "Not required", dueDate: "2026-10-18", taskId: "TSK-015" },
  { id: "CNT-010", title: "Press release: farm-to-table dinner", platform: "PR", campaignId: "CMP-006", productIds: ["PRD-008", "PRD-009"], status: "In review", approvalStatus: "Pending approval", dueDate: "2026-10-11", note: "Menu lists duck breast; check stock first." },
  { id: "CNT-011", title: "Herb sausage breakfast reel", platform: "Instagram", campaignId: null, productId: "PRD-011", status: "Scheduled", approvalStatus: "Approved", publishDate: "2026-10-09" },
]);

// ---------- events ----------
const events = mock([
  { id: "EVT-001", name: "Bangkok Gourmet Expo 2026 (MOCK)", type: "Trade and consumer fair", startDate: "2026-10-25", endDate: "2026-10-27", location: "Exhibition hall, Bangkok (MOCK)", contact: "CON-204", budgetThb: 85000, status: "Booked", productIds: ["PRD-010", "PRD-011", "PRD-012"], goals: ["Sample bone broth to 2,000 visitors", "Collect 300 LINE OA friends", "Meet 15 hotel and restaurant buyers"], taskId: "TSK-008", campaignId: "CMP-003" },
  { id: "EVT-002", name: "Farm visit for Green Basket shoppers (MOCK)", type: "Customer event", startDate: "2026-11-08", endDate: "2026-11-08", location: "FARM-02 Kanchanaburi (MOCK)", budgetThb: 30000, status: "Idea", productIds: ["PRD-005"], customerId: "CUS-132", note: "Could help explain the organic egg price." },
  { id: "EVT-003", name: "Christmas duck menu tasting (MOCK)", type: "B2B tasting", startDate: "2026-10-21", endDate: "2026-10-21", location: "Sukhumvit Garden Residence Hotel kitchen (MOCK)", customerId: "CUS-102", budgetThb: 8000, status: "Confirmed", productIds: ["PRD-008", "PRD-012"], note: "Whole duck supply is reduced in November (PO-2026-0412): agree volumes carefully." },
  { id: "EVT-004", name: "Farm-to-table dinner with Chef's Table (MOCK)", type: "PR dinner", startDate: "2026-10-18", endDate: "2026-10-18", location: "Chef's Table Private Dining, Bangkok (MOCK)", customerId: "CUS-121", budgetThb: 45000, status: "Confirmed", productIds: ["PRD-008", "PRD-009", "PRD-012"], campaignId: "CMP-006", note: "Duck breast needed (PRD-009, out of stock until 15 Oct). Magazine wants a feature (EML-009)." },
]);

// ---------- complaints ----------
const complaints = mock([
  { id: "CPL-001", date: "2026-10-05", customerId: "CUS-111", contactId: "CON-111", channel: "Email", type: "Product availability", productId: "PRD-009", orderId: affected.id, severity: "High", summary: "Duck breast missing from two deliveries; signature dish off the menu.", status: "Open", followUp: { taskId: "TSK-003", due: "2026-10-07", owner: "CON-005" }, resolution: null, rootCause: "Partner duck farm delay (PO-2026-0409)." },
  { id: "CPL-002", date: "2026-10-03", customerId: "CUS-001", channel: "Website", type: "Delivery", productId: "PRD-002", severity: "Medium", summary: "Website order delivered a day late in Bang Kapi; ice packs melted.", status: "In progress", followUp: { taskId: "TSK-019", due: "2026-10-09", owner: "CON-005" }, resolution: "Refund of delivery fee offered.", rootCause: "Extra Protein Week orders on one route." },
  { id: "CPL-003", date: "2026-10-04", customerId: "CUS-131", contactId: "CON-131", channel: "Email", type: "Packaging", productId: "PRD-004", severity: "High", summary: "46 cartons of eggs removed for cracks in 3 branches; new carton feels thinner.", status: "In progress", followUp: { taskId: "TSK-010", due: "2026-10-06", owner: "CON-004", meetingId: "MTG-004" }, resolution: null, rootCause: "Suspected: lighter carton introduced 1 Sep to save cost (expenses, Packaging). Reinforced carton proposed (PO-2026-0418).", impact: "Partner cut egg orders about 20% (sales: Retail, PRD-004)." },
  { id: "CPL-004", date: "2026-09-21", customerId: "CUS-002", channel: "LINE OA", type: "Product quality", productId: "PRD-016", severity: "Low", summary: "Smoked breast too salty for a customer's child.", status: "Resolved", resolution: "Explained the recipe; 1 pack replaced. Shared with product team.", resolvedAt: "2026-09-23" },
  { id: "CPL-005", date: "2026-09-12", customerId: "CUS-103", contactId: "CON-103", channel: "Phone", type: "Delivery", productId: "PRD-001", severity: "Medium", summary: "Delivery to Hua Hin arrived after kitchen closing time.", status: "Resolved", resolution: "Moved Hua Hin deliveries to the 06:00 truck.", resolvedAt: "2026-09-14" },
  { id: "CPL-006", date: "2026-10-06", customerId: "CUS-001", channel: "Website", type: "Delivery", productId: "PRD-002", severity: "Medium", summary: "Second late Protein Week order (Lat Phrao).", status: "Open", followUp: { taskId: "TSK-019", due: "2026-10-09", owner: "CON-005" }, resolution: null },
  { id: "CPL-007", date: "2026-08-28", customerId: "CUS-132", contactId: "CON-132", channel: "Email", type: "Pricing", productId: "PRD-005", severity: "Low", summary: "Buyer reports shoppers choosing a cheaper organic egg brand.", status: "Open", followUp: { taskId: "TSK-011", due: "2026-10-12", owner: "CON-001" }, resolution: null },
]);

// ---------- documents ----------
const documents = mock([
  { id: "DOC-001", name: "September 2026 Marketing Report (MOCK).docx", kind: "Word", date: "2026-10-05", owner: "CON-001", summary: "September sales by channel, campaign results, declining products, Q4 plan.", related: { meetingId: "MTG-006" } },
  { id: "DOC-002", name: "Q4 2026 Hotel Price List (MOCK, draft).xlsx", kind: "Spreadsheet", date: "2026-10-01", owner: "CON-002", status: "Draft", summary: "Hotel prices for Oct-Dec; whole duck volume note for December.", related: { taskId: "TSK-005", customerIds: ["CUS-101", "CUS-102", "CUS-103"] } },
  { id: "DOC-003", name: "Protein Week campaign brief (MOCK).pdf", kind: "PDF", date: "2026-09-20", owner: "CON-006", summary: "Objective, audience, offer, budget, creative plan.", related: { campaignId: "CMP-001" } },
  { id: "DOC-004", name: "Bone broth product spec sheet (MOCK).pdf", kind: "PDF", date: "2026-09-10", owner: "CON-004", summary: "Ingredients, storage, shelf life 12 months frozen, allergens: none declared (MOCK).", related: { productId: "PRD-010" } },
  { id: "DOC-005", name: "Egg carton test results (MOCK).pdf", kind: "PDF", date: "2026-10-08", owner: "CON-004", status: "Expected", summary: "Drop and stack test of the new vs reinforced carton.", related: { complaintId: "CPL-003" } },
  { id: "DOC-006", name: "Press kit 2026 (MOCK).pptx", kind: "Slides", date: "2026-08-15", owner: "CON-006", summary: "Farm story, photos, approved product facts.", related: { campaignId: "CMP-006" } },
  { id: "DOC-007", name: "Ember & Rice Grill proposal (MOCK).pdf", kind: "PDF", date: "2026-09-26", owner: "CON-002", summary: "Restaurant prices for wings, thigh, native chicken; trial order offer.", related: { customerId: "CUS-112" } },
  { id: "DOC-008", name: "Nong Lek supply agreement draft (MOCK).docx", kind: "Word", date: "2026-10-04", owner: "CON-002", status: "Draft", summary: "12-month supply for wings and thigh with volume tiers.", related: { customerId: "CUS-113" } },
  { id: "DOC-009", name: "Bangkok Gourmet Expo exhibitor manual (MOCK).pdf", kind: "PDF", date: "2026-09-01", owner: "CON-006", summary: "Booth rules, sampling rules, deadlines.", related: { eventId: "EVT-001" } },
  { id: "DOC-010", name: "Organic egg competitor price check (MOCK).xlsx", kind: "Spreadsheet", date: "2026-10-03", owner: "CON-001", summary: "Shelf prices of 4 organic egg brands in 6 stores (MOCK).", related: { productId: "PRD-005", taskId: "TSK-011" } },
]);

// ---------- knowledge ----------
const knowledge = {
  _meta: meta("Background knowledge the AI secretary may use: policies, product facts and business rules of the fictional company."),
  articles: mock([
    { id: "KB-001", topic: "Approval rules", text: "The Marketing Director must approve before anything is published, sent to customers, repriced, launched, or committed commercially. Approving in the app only records the decision (MOCK policy)." },
    { id: "KB-002", topic: "Brand voice", text: "Write like the people who raise the animals: honest, warm, calm. No em or en dashes. Describe farming practice, never health outcomes. No bare 'hormone-free' claims (MOCK guide)." },
    { id: "KB-003", topic: "Delivery", text: "Bangkok and vicinity: next day by own cold-chain trucks, order by 14:00. Hua Hin: Tuesday and Friday, 06:00 truck. Eastern Seaboard: via Pathum Fresh Wholesale (MOCK)." },
    { id: "KB-004", topic: "Stock and promotion rule", text: "Do not start or extend a promotion when available stock covers fewer than 7 days at the expected promo pace; agree with production first (MOCK rule)." },
    { id: "KB-005", topic: "Shelf life", text: "Fresh chicken 7 days chilled; eggs 30 days; liquid yolk 21 days chilled; bone broth 12 months frozen; smoked breast 45 days chilled (MOCK figures)." },
    { id: "KB-006", topic: "Price lists", text: "Price lists: website (consumers), retail (to retail partners), restaurant, hotel, b2b (wholesale and corporate). Discounts beyond 10% off a list price need approval (MOCK rule)." },
    { id: "KB-007", topic: "Duck supply", text: "All duck products come from the partner Suphan Duck Cooperative (MOCK). Lead time 2-3 weeks; volumes can change with weather." },
    { id: "KB-008", topic: "Key account follow-up rule", text: "A B2B account with no order for 30 days, or an unanswered customer email older than 2 working days, needs a follow-up task (MOCK rule)." },
    { id: "KB-009", topic: "Complaint handling", text: "Reply within 1 working day, resolve within 5. High-severity complaints from key accounts go to the Marketing Director (MOCK policy)." },
  ]),
};

// ---------- sales highlights (computed, so they always match the numbers) ----------
const pp = (pid) => byProduct.find((p) => p.productId === pid);
const ch = (name) => byChannel.find((c) => c.channel === name);
const signed = (n) => (n > 0 ? `+${n}` : `${n}`);
const highlights = [
  `Total revenue: July ${totalByMonth[0].toLocaleString("en-US")}, August ${totalByMonth[1].toLocaleString("en-US")}, September ${totalByMonth[2].toLocaleString("en-US")} baht; 1-6 Oct ${totalByMonth[3].toLocaleString("en-US")} baht (MOCK).`,
  `Breast fillet (PRD-002) October pace is ${signed(pp("PRD-002").octoberPaceVsSepPct)}% vs September because of Protein Week (CMP-001); stock is low (inventory).`,
  `Hotel channel July to September: ${signed(pct(ch("Hotel").revenueThb["2026-09"], ch("Hotel").revenueThb["2026-07"]))}%. Chao Phraya Lantern Hotel (CUS-101) has not ordered since ${lastOrder("CUS-101")}.`,
  `Retail channel September vs August: ${signed(ch("Retail").changeSepVsAugPct)}% (cracked-egg issue at CUS-131, organic eggs down at CUS-132).`,
  `Wholesale September vs August: ${signed(ch("Wholesale").changeSepVsAugPct)}% (Pathum Fresh up, Eastern Seaboard down).`,
  `Organic-feed eggs (PRD-005) units September vs August: ${signed(pp("PRD-005").unitsChangeSepVsAugPct)}%. Smoked breast (PRD-016): ${signed(pp("PRD-016").unitsChangeSepVsAugPct)}%. Salted duck eggs (PRD-007): ${signed(pp("PRD-007").unitsChangeSepVsAugPct)}%.`,
  `New products: herb sausage (PRD-011) September vs August ${signed(pp("PRD-011").unitsChangeSepVsAugPct)}%; bone broth (PRD-010) October pace ${pp("PRD-010").octoberPaceUnitsPer30Days} pouches per 30 days vs a 1,500 target.`,
];

// ---------- write everything ----------
write("company.json", company);
write("products.json", { _meta: meta("Product catalogue. Prices are in pricing.json; stock in inventory.json."), products: mock(productsList.map(({ price, ...p }) => ({ ...p, websitePriceThb: price.website || null }))) });
write("pricing.json", { _meta: meta("Price lists per channel and promotion prices. 0 or null = not sold in that channel.", { priceKeys: { website: "consumer price on website and LINE OA", retail: "price to retail partners", retailShelf: "recommended shelf price at retail partners", restaurant: "restaurant and chef price list", hotel: "hotel price list", b2b: "wholesale and corporate price", cost: "production cost (internal)" } }), prices: mock(productsList.map((p) => ({ productId: p.id, name: p.name, unit: p.unit, ...Object.fromEntries(Object.entries(p.price).map(([k, v]) => [k, v || null])) }))), promotions: mock(promotions) });
write("tasks.json", { _meta: meta("Tasks, follow-ups and approval requests. 'Today' is 2026-10-07; dueDate before today and not Done = overdue."), tasks });
write("calendar.json", { _meta: meta("Calendar items: meetings, deadlines, follow-ups, events, campaign milestones and supply dates."), items: calendar });
write("meetings.json", { _meta: meta("Meetings with agenda, attendees (contact ids) and related records."), meetings });
write("contacts.json", { _meta: meta("Fictional internal team and business contacts. Names, emails (example domains) and phone numbers are invented."), contacts });
write("customers.json", { _meta: meta("All customers: B2C segments, retail partners and B2B accounts (businesses only, no private individuals)."), customers });
write("b2b_accounts.json", { _meta: meta("B2B account details. lastOrderDate, revenue and top products are calculated from sales.json orders."), accounts: b2bAccounts });
write("emails.json", { _meta: meta("Inbox sample. Addresses use example domains."), emails });
write("sales.json", { _meta: meta("Sales July to 6 October 2026. 'monthly' is by month, channel and product (October = 1-6 Oct). B2B and retail rows are the sum of 'orders'; website and LINE OA rows are B2C totals.", { period: { from: "2026-07-01", to: "2026-10-06" } }), highlights, totalsByMonthThb: { "2026-07": totalByMonth[0], "2026-08": totalByMonth[1], "2026-09": totalByMonth[2], "2026-10 (1-6 Oct)": totalByMonth[3] }, byChannel, byProduct, monthly: mock(monthly), orders: mock(orders) });
write("inventory.json", { _meta: meta("Stock on 7 Oct 2026. dailyAvgSales blends September and 1-6 Oct; daysOfCover = available / dailyAvgSales."), inventory: mock(inventory) });
write("purchases.json", { _meta: meta("Purchase orders to suppliers."), purchases });
write("expenses.json", { _meta: meta("Monthly expenses by category (selected categories)."), expenses });
write("marketing.json", marketing);
write("campaigns.json", { _meta: meta("Marketing campaigns with products, budgets, status and results."), campaigns });
write("content.json", { _meta: meta("Content plan and drafts. Drafts follow the brand rules (no em dashes, practice not health claims)."), content });
write("events.json", { _meta: meta("Events, tastings and fairs."), events });
write("complaints.json", { _meta: meta("Customer complaints with follow-up and resolution status."), complaints });
write("documents.json", { _meta: meta("Document list (names and summaries only; no files)."), documents });
write("knowledge.json", knowledge);
console.log(`MOCK DATA written to ${OUT}: ${orders.length} orders, ${monthly.length} monthly sales rows.`);
