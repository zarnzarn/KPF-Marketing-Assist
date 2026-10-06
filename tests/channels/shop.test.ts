import { afterEach, describe, expect, it, vi } from "vitest";
import { shopSnapshot, stockFrom } from "@/lib/channels/shop";
import type { FetchLike } from "@/lib/channels/readOnlyFetch";
import type { ChannelSnapshot } from "@/lib/channels/types";

// All data below is synthetic and shaped like the official Shopify Admin GraphQL API
// and WooCommerce REST API (v3) answers. No real shops, products, keys or tokens.
// The network is never used: every test injects fetchImpl.

const TOKEN = "test-token-1234567890";
const KEY = "test-key-1234567890";
const SECRET = "fake-secret-abcdef";
// Built independently of the source (btoa, not Buffer) so the test checks the real header value.
const BASIC = btoa(`${KEY}:${SECRET}`);
const NOW = new Date("2026-10-06T03:00:00.000Z");

const SHOPIFY_URL = "https://synthetic-farm.myshopify.com";
const SHOPIFY_GRAPHQL = "https://synthetic-farm.myshopify.com/admin/api/2025-01/graphql.json";
const WOO_URL = "https://shop.example.com";
const WOO_PRODUCTS = "https://shop.example.com/wp-json/wc/v3/products?per_page=100&status=publish";

interface RecordedCall {
  url: string;
  method: string | undefined;
  headers: Record<string, string>;
  body: unknown;
}

interface Reply {
  status: number;
  body: unknown;
}

/** A fake fetch that answers in order and records every call. */
function recordingFetch(replies: Reply[]) {
  const calls: RecordedCall[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, method: init?.method, headers: { ...((init?.headers as Record<string, string>) ?? {}) }, body: init?.body });
    const reply = replies[calls.length - 1];
    if (!reply) throw new Error(`Unexpected extra request #${calls.length}`);
    const text = typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body);
    return new Response(text, { status: reply.status, headers: { "Content-Type": "application/json" } });
  };
  return { fetchImpl, calls };
}

const ok = (body: unknown): Reply => ({ status: 200, body });

const shopifyEnv = (extra: Record<string, string | undefined> = {}) => ({ SHOP_PLATFORM: "shopify", SHOP_URL: SHOPIFY_URL, SHOP_API_KEY: TOKEN, ...extra });
const wooEnv = (extra: Record<string, string | undefined> = {}) => ({ SHOP_PLATFORM: "woocommerce", SHOP_URL: WOO_URL, SHOP_API_KEY: KEY, SHOP_API_SECRET: SECRET, ...extra });

/** Asserts none of the exact secrets is anywhere in what the browser would receive. */
function expectNoSecret(snapshot: ChannelSnapshot, secrets: string[] = [TOKEN, KEY, SECRET, BASIC]) {
  const text = JSON.stringify(snapshot);
  for (const secret of secrets) expect(text).not.toContain(secret);
}

const metric = (snap: ChannelSnapshot, label: string) => snap.metrics.find((m) => m.label === label)?.value;

// Shaped like one node of `products { nodes { ... } }` in the Shopify Admin GraphQL API.
interface ShopifyNode {
  id: string;
  title: string;
  status: string;
  productType?: string;
  totalInventory?: number | null;
  tracksInventory?: boolean;
  variants?: { nodes?: { price?: string | null }[] };
}

let shopifyId = 1000;
function shopifyNode(extra: Partial<ShopifyNode> = {}): ShopifyNode {
  shopifyId += 1;
  return {
    id: `gid://shopify/Product/${shopifyId}`,
    title: `Synthetic product ${shopifyId}`,
    status: "ACTIVE",
    productType: "Synthetic type",
    totalInventory: 50,
    tracksInventory: true,
    variants: { nodes: [{ price: "100.00" }] },
    ...extra,
  };
}

const shopifyAnswer = (nodes: ShopifyNode[]) => ({
  data: { products: { nodes } },
  extensions: { cost: { requestedQueryCost: 12, actualQueryCost: 12 } },
});

// Shaped like one item of GET /wp-json/wc/v3/products in the WooCommerce REST API.
interface WooItem {
  id: number;
  name: string;
  status: string;
  price?: string;
  stock_status?: string;
  stock_quantity?: number | null;
  manage_stock?: boolean;
  categories?: { id: number; name: string; slug: string }[];
}

let wooId = 100;
function wooItem(extra: Partial<WooItem> = {}): WooItem {
  wooId += 1;
  return {
    id: wooId,
    name: `Synthetic item ${wooId}`,
    status: "publish",
    price: "100",
    stock_status: "instock",
    stock_quantity: 50,
    manage_stock: true,
    categories: [{ id: 15, name: "Synthetic category", slug: "synthetic-category" }],
    ...extra,
  };
}

/** Reads one Shopify snapshot for the given product nodes. */
async function readShopify(nodes: ShopifyNode[], extraEnv: Record<string, string | undefined> = {}) {
  const { fetchImpl, calls } = recordingFetch([ok(shopifyAnswer(nodes))]);
  const snap = await shopSnapshot({ env: shopifyEnv(extraEnv), fetchImpl, now: NOW });
  return { snap, calls };
}

/** Reads one WooCommerce snapshot for the given items. */
async function readWoo(items: WooItem[], extraEnv: Record<string, string | undefined> = {}) {
  const { fetchImpl, calls } = recordingFetch([ok(items)]);
  const snap = await shopSnapshot({ env: wooEnv(extraEnv), fetchImpl, now: NOW });
  return { snap, calls };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("stockFrom", () => {
  const IN_STOCK = { stockStatus: "In stock", availability: "Available" };
  const LOW = { stockStatus: "Low stock", availability: "Limited" };
  const OUT = { stockStatus: "Out of stock", availability: "Unavailable" };

  it("treats an unknown quantity as in stock unless the shop says it is not", () => {
    expect(stockFrom(null, true, 5)).toEqual(IN_STOCK);
    expect(stockFrom(undefined, true, 5)).toEqual(IN_STOCK);
    expect(stockFrom(null, undefined, 5)).toEqual(IN_STOCK);
    expect(stockFrom(undefined, undefined, 5)).toEqual(IN_STOCK);
  });

  it("treats an unknown quantity as out of stock when the in-stock flag is false", () => {
    expect(stockFrom(null, false, 5)).toEqual(OUT);
    expect(stockFrom(undefined, false, 5)).toEqual(OUT);
  });

  it("is out of stock at zero, even when the in-stock flag is true", () => {
    expect(stockFrom(0, undefined, 5)).toEqual(OUT);
    expect(stockFrom(0, true, 5)).toEqual(OUT);
  });

  it("is out of stock for a negative quantity (oversold)", () => {
    expect(stockFrom(-1, undefined, 5)).toEqual(OUT);
    expect(stockFrom(-25, true, 5)).toEqual(OUT);
  });

  it("is low stock from 1 up to and including the low-stock level", () => {
    expect(stockFrom(1, undefined, 5)).toEqual(LOW);
    expect(stockFrom(4, undefined, 5)).toEqual(LOW);
    expect(stockFrom(5, undefined, 5)).toEqual(LOW);
  });

  it("is in stock above the low-stock level", () => {
    expect(stockFrom(6, undefined, 5)).toEqual(IN_STOCK);
    expect(stockFrom(1000, undefined, 5)).toEqual(IN_STOCK);
  });

  it("follows a different low-stock level", () => {
    expect(stockFrom(20, undefined, 20)).toEqual(LOW);
    expect(stockFrom(21, undefined, 20)).toEqual(IN_STOCK);
  });

  it("never reports low stock when the low-stock level is 0", () => {
    expect(stockFrom(1, undefined, 0)).toEqual(IN_STOCK);
    expect(stockFrom(0, undefined, 0)).toEqual(OUT);
  });

  it("uses a known quantity over the in-stock flag", () => {
    expect(stockFrom(10, false, 5)).toEqual(IN_STOCK);
    expect(stockFrom(3, false, 5)).toEqual(LOW);
  });
});

describe("shopSnapshot — not configured", () => {
  function expectNotConfigured(snap: ChannelSnapshot) {
    expect(snap.channel).toBe("shop");
    expect(snap.label).toBe("Shop (products & stock)");
    expect(snap.status).toBe("not_configured");
    expect(snap.metrics).toEqual([]);
    expect(snap.items).toEqual([]);
    expect(snap.products).toBeUndefined();
    expect(snap.fetchedAt).toBeUndefined();
    expect(snap.message).toContain("SHOP_PLATFORM");
    expect(snap.message).toContain("SHOP_URL");
    expect(snap.message).toContain(".env.local");
    expectNoSecret(snap);
  }

  it("is not_configured and makes no request when nothing is set", async () => {
    const { fetchImpl, calls } = recordingFetch([]);
    const snap = await shopSnapshot({ env: {}, fetchImpl, now: NOW });
    expectNotConfigured(snap);
    expect(calls).toHaveLength(0);
  });

  it("is not_configured when SHOP_PLATFORM is missing, even with an address and keys", async () => {
    const { fetchImpl, calls } = recordingFetch([]);
    const snap = await shopSnapshot({ env: wooEnv({ SHOP_PLATFORM: undefined }), fetchImpl, now: NOW });
    expectNotConfigured(snap);
    expect(calls).toHaveLength(0);
  });

  it("is not_configured for a platform it does not support", async () => {
    const { fetchImpl, calls } = recordingFetch([]);
    for (const platform of ["magento", "wix", "shopify-plus", "woo"]) {
      expectNotConfigured(await shopSnapshot({ env: wooEnv({ SHOP_PLATFORM: platform }), fetchImpl, now: NOW }));
    }
    expect(calls).toHaveLength(0);
  });

  it("is not_configured for Shopify without SHOP_URL", async () => {
    const { fetchImpl, calls } = recordingFetch([]);
    expectNotConfigured(await shopSnapshot({ env: shopifyEnv({ SHOP_URL: undefined }), fetchImpl, now: NOW }));
    expect(calls).toHaveLength(0);
  });

  it("is not_configured for Shopify without SHOP_API_KEY", async () => {
    const { fetchImpl, calls } = recordingFetch([]);
    expectNotConfigured(await shopSnapshot({ env: shopifyEnv({ SHOP_API_KEY: undefined }), fetchImpl, now: NOW }));
    expect(calls).toHaveLength(0);
  });

  it("does not need SHOP_API_SECRET for Shopify", async () => {
    const { fetchImpl, calls } = recordingFetch([ok(shopifyAnswer([]))]);
    const snap = await shopSnapshot({ env: shopifyEnv({ SHOP_API_SECRET: undefined }), fetchImpl, now: NOW });
    expect(snap.status).toBe("connected");
    expect(calls).toHaveLength(1);
  });

  it("is not_configured for WooCommerce without SHOP_API_SECRET", async () => {
    const { fetchImpl, calls } = recordingFetch([]);
    expectNotConfigured(await shopSnapshot({ env: wooEnv({ SHOP_API_SECRET: undefined }), fetchImpl, now: NOW }));
    expect(calls).toHaveLength(0);
  });

  it("is not_configured for WooCommerce without SHOP_API_KEY or SHOP_URL", async () => {
    const { fetchImpl, calls } = recordingFetch([]);
    expectNotConfigured(await shopSnapshot({ env: wooEnv({ SHOP_API_KEY: undefined }), fetchImpl, now: NOW }));
    expectNotConfigured(await shopSnapshot({ env: wooEnv({ SHOP_URL: undefined }), fetchImpl, now: NOW }));
    expect(calls).toHaveLength(0);
  });

  it("treats blank or quote-only values as missing", async () => {
    const { fetchImpl, calls } = recordingFetch([]);
    for (const value of ["", "   ", '""', "''"]) {
      expectNotConfigured(await shopSnapshot({ env: shopifyEnv({ SHOP_API_KEY: value }), fetchImpl, now: NOW }));
      expectNotConfigured(await shopSnapshot({ env: wooEnv({ SHOP_API_SECRET: value }), fetchImpl, now: NOW }));
      expectNotConfigured(await shopSnapshot({ env: wooEnv({ SHOP_PLATFORM: value }), fetchImpl, now: NOW }));
    }
    expect(calls).toHaveLength(0);
  });

  it("treats a SHOP_URL of only slashes as missing", async () => {
    const { fetchImpl, calls } = recordingFetch([]);
    expectNotConfigured(await shopSnapshot({ env: shopifyEnv({ SHOP_URL: "///" }), fetchImpl, now: NOW }));
    expect(calls).toHaveLength(0);
  });
});

describe("shopSnapshot — unsafe or wrong addresses", () => {
  it("blocks a Shopify SHOP_URL that starts with http:// and makes no request", async () => {
    const { fetchImpl, calls } = recordingFetch([]);
    const snap = await shopSnapshot({ env: shopifyEnv({ SHOP_URL: "http://synthetic-farm.myshopify.com" }), fetchImpl, now: NOW });
    expect(calls).toHaveLength(0);
    expect(snap.status).toBe("error");
    expect(snap.message).toBe("SHOP_URL must start with https://");
    expect(snap.fetchedAt).toBe(NOW.toISOString());
    expect(snap.metrics).toEqual([]);
    expect(snap.items).toEqual([]);
    expect(snap.products).toBeUndefined();
    expectNoSecret(snap);
  });

  it("blocks a WooCommerce SHOP_URL that starts with http:// and makes no request", async () => {
    const { fetchImpl, calls } = recordingFetch([]);
    const snap = await shopSnapshot({ env: wooEnv({ SHOP_URL: "http://shop.example.com" }), fetchImpl, now: NOW });
    expect(calls).toHaveLength(0);
    expect(snap.status).toBe("error");
    expect(snap.message).toBe("SHOP_URL must start with https://");
    expect(snap.products).toBeUndefined();
    expectNoSecret(snap);
  });

  it("blocks a SHOP_URL without https:// at the start (bare host name)", async () => {
    const { fetchImpl, calls } = recordingFetch([]);
    const shopify = await shopSnapshot({ env: shopifyEnv({ SHOP_URL: "synthetic-farm.myshopify.com" }), fetchImpl, now: NOW });
    const woo = await shopSnapshot({ env: wooEnv({ SHOP_URL: "shop.example.com" }), fetchImpl, now: NOW });
    expect(calls).toHaveLength(0);
    for (const snap of [shopify, woo]) {
      expect(snap.status).toBe("error");
      expect(snap.message).toBe("SHOP_URL must start with https://");
      expectNoSecret(snap);
    }
  });

  it("blocks a Shopify shop that is not on myshopify.com, because only that GraphQL address may receive a read-only POST", async () => {
    const { fetchImpl, calls } = recordingFetch([]);
    const snap = await shopSnapshot({ env: shopifyEnv({ SHOP_URL: "https://shop.example.com" }), fetchImpl, now: NOW });
    expect(calls).toHaveLength(0);
    expect(snap.status).toBe("error");
    expect(snap.message).toBe("This request is not on the read-only list and was blocked.");
    expect(snap.products).toBeUndefined();
    expectNoSecret(snap);
  });
});

describe("shopSnapshot — Shopify request", () => {
  it("makes exactly one POST to the Admin GraphQL address for API version 2025-01", async () => {
    const { calls } = await readShopify([]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(SHOPIFY_GRAPHQL);
    expect(calls[0].method).toBe("POST");
  });

  it("sends the token only in the X-Shopify-Access-Token header, never in the address or body", async () => {
    const { calls } = await readShopify([]);
    expect(calls[0].headers).toEqual({ "X-Shopify-Access-Token": TOKEN, "Content-Type": "application/json" });
    expect(calls[0].url).not.toContain(TOKEN);
    expect(String(calls[0].body)).not.toContain(TOKEN);
  });

  it("sends a JSON body with a read-only GraphQL query and no mutation", async () => {
    const { calls } = await readShopify([]);
    const body = JSON.parse(String(calls[0].body)) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(["query"]);
    const query = String(body.query);
    expect(query.trim().startsWith("query")).toBe(true);
    expect(query).not.toMatch(/mutation/i);
    expect(query).toContain("products(first: 100");
    for (const field of ["id", "title", "status", "productType", "totalInventory", "tracksInventory", "price"]) {
      expect(query).toContain(field);
    }
  });

  it("uses the settings without quotes, spaces, trailing slashes or capital letters in the platform name", async () => {
    const { fetchImpl, calls } = recordingFetch([ok(shopifyAnswer([]))]);
    const snap = await shopSnapshot({
      env: { SHOP_PLATFORM: " Shopify ", SHOP_URL: ` "${SHOPIFY_URL}/" `, SHOP_API_KEY: ` '${TOKEN}' ` },
      fetchImpl,
      now: NOW,
    });
    expect(snap.status).toBe("connected");
    expect(calls[0].url).toBe(SHOPIFY_GRAPHQL);
    expect(calls[0].headers["X-Shopify-Access-Token"]).toBe(TOKEN);
  });
});

describe("shopSnapshot — Shopify products", () => {
  it("maps an active product to the app's product shape", async () => {
    const node = shopifyNode({
      id: "gid://shopify/Product/9000001",
      title: "Synthetic Free-Range Whole Chicken",
      status: "ACTIVE",
      productType: "Synthetic chicken",
      totalInventory: 40,
      tracksInventory: true,
      variants: { nodes: [{ price: "320.00" }] },
    });
    const { snap } = await readShopify([node]);
    expect(snap.status).toBe("connected");
    expect(snap.products).toEqual([
      {
        id: "gid://shopify/Product/9000001",
        name: "Synthetic Free-Range Whole Chicken",
        category: "Synthetic chicken",
        status: "Active",
        priceThb: 320,
        priceUnit: "per item",
        channels: ["Website"],
        stockStatus: "In stock",
        availability: "Available",
        stockUnits: 40,
        reorderLevel: 5,
        isNew: false,
      },
    ]);
  });

  it("shows a DRAFT product as Paused", async () => {
    const { snap } = await readShopify([shopifyNode({ status: "DRAFT" })]);
    expect(snap.products?.[0].status).toBe("Paused");
  });

  it("shows any status other than ACTIVE as Paused", async () => {
    const { snap } = await readShopify([shopifyNode({ status: "ARCHIVED" }), shopifyNode({ status: "active" })]);
    expect(snap.products?.map((p) => p.status)).toEqual(["Paused", "Paused"]);
  });

  it('uses "Uncategorised" when the product type is empty or missing', async () => {
    const { snap } = await readShopify([shopifyNode({ productType: "" }), shopifyNode({ productType: undefined })]);
    expect(snap.products?.map((p) => p.category)).toEqual(["Uncategorised", "Uncategorised"]);
  });

  it("reads the price of the first variant as a number", async () => {
    const { snap } = await readShopify([
      shopifyNode({ variants: { nodes: [{ price: "120.50" }, { price: "999.00" }] } }),
      shopifyNode({ variants: { nodes: [{ price: "0.00" }] } }),
    ]);
    expect(snap.products?.map((p) => p.priceThb)).toEqual([120.5, 0]);
    expect(typeof snap.products?.[0].priceThb).toBe("number");
  });

  it("works out stock from totalInventory with the default low-stock level of 5", async () => {
    const { snap } = await readShopify([
      shopifyNode({ totalInventory: 6 }),
      shopifyNode({ totalInventory: 5 }),
      shopifyNode({ totalInventory: 1 }),
      shopifyNode({ totalInventory: 0 }),
      shopifyNode({ totalInventory: -3 }),
    ]);
    expect(snap.products?.map((p) => [p.stockStatus, p.availability, p.stockUnits, p.reorderLevel])).toEqual([
      ["In stock", "Available", 6, 5],
      ["Low stock", "Limited", 5, 5],
      ["Low stock", "Limited", 1, 5],
      ["Out of stock", "Unavailable", 0, 5],
      ["Out of stock", "Unavailable", -3, 5],
    ]);
  });

  it("shows a product that does not track inventory as in stock, whatever totalInventory says", async () => {
    const { snap } = await readShopify([
      shopifyNode({ tracksInventory: false, totalInventory: 0 }),
      shopifyNode({ tracksInventory: false, totalInventory: -4 }),
      shopifyNode({ tracksInventory: false, totalInventory: 2 }),
      shopifyNode({ tracksInventory: false, totalInventory: null }),
    ]);
    expect(snap.products?.map((p) => [p.stockStatus, p.availability])).toEqual([
      ["In stock", "Available"],
      ["In stock", "Available"],
      ["In stock", "Available"],
      ["In stock", "Available"],
    ]);
    expect(snap.products?.map((p) => p.stockUnits)).toEqual([0, -4, 2, 0]);
  });

  it("shows 0 stock units when totalInventory is not sent", async () => {
    const { snap } = await readShopify([shopifyNode({ totalInventory: null }), shopifyNode({ totalInventory: undefined, tracksInventory: undefined })]);
    expect(snap.products?.map((p) => [p.stockStatus, p.stockUnits])).toEqual([
      ["In stock", 0],
      ["In stock", 0],
    ]);
  });

  it("respects SHOP_LOW_STOCK", async () => {
    const { snap } = await readShopify([shopifyNode({ totalInventory: 10 }), shopifyNode({ totalInventory: 11 })], { SHOP_LOW_STOCK: "10" });
    expect(snap.products?.map((p) => [p.stockStatus, p.reorderLevel])).toEqual([
      ["Low stock", 10],
      ["In stock", 10],
    ]);
  });

  it("accepts SHOP_LOW_STOCK of 0", async () => {
    const { snap } = await readShopify([shopifyNode({ totalInventory: 1 }), shopifyNode({ totalInventory: 0 })], { SHOP_LOW_STOCK: "0" });
    expect(snap.products?.map((p) => [p.stockStatus, p.reorderLevel])).toEqual([
      ["In stock", 0],
      ["Out of stock", 0],
    ]);
  });

  it("falls back to the default of 5 when SHOP_LOW_STOCK is not a number", async () => {
    const { snap } = await readShopify([shopifyNode({ totalInventory: 3 })], { SHOP_LOW_STOCK: "five" });
    expect(snap.products?.[0].reorderLevel).toBe(5);
    expect(snap.products?.[0].stockStatus).toBe("Low stock");
  });

  it("leaves products without a price out of the product list", async () => {
    const priced = shopifyNode({ title: "Synthetic priced product" });
    const { snap } = await readShopify([
      priced,
      shopifyNode({ variants: { nodes: [] } }),
      shopifyNode({ variants: undefined }),
      shopifyNode({ variants: { nodes: [{ price: null }] } }),
      shopifyNode({ variants: { nodes: [{}] } }),
      shopifyNode({ variants: { nodes: [{ price: "not a price" }] } }),
    ]);
    expect(snap.status).toBe("connected");
    expect(snap.products?.map((p) => p.name)).toEqual(["Synthetic priced product"]);
  });

  // Actual behaviour: the metrics are counted from ALL products the shop sent, including the ones
  // left out of snapshot.products because they have no price. (Reported as a suspected source bug:
  // the Channels page and the Products page then disagree.)
  it("still counts products without a price in the metrics", async () => {
    const { snap } = await readShopify([
      shopifyNode({ totalInventory: 50 }),
      shopifyNode({ totalInventory: 2, variants: { nodes: [] } }),
      shopifyNode({ totalInventory: 0, variants: { nodes: [] } }),
    ]);
    expect(snap.products).toHaveLength(1);
    expect(metric(snap, "Products")).toBe("3");
    expect(metric(snap, "Low stock")).toBe("1");
    expect(metric(snap, "Out of stock")).toBe("1");
  });

  it("shows Products, Low stock and Out of stock counts as text, in that order", async () => {
    const { snap } = await readShopify([
      shopifyNode({ totalInventory: 50 }),
      shopifyNode({ totalInventory: 9 }),
      shopifyNode({ totalInventory: 5 }),
      shopifyNode({ totalInventory: 2 }),
      shopifyNode({ totalInventory: 0 }),
      shopifyNode({ tracksInventory: false, totalInventory: 0 }),
    ]);
    expect(snap.metrics).toEqual([
      { label: "Products", value: "6" },
      { label: "Low stock", value: "2" },
      { label: "Out of stock", value: "1" },
    ]);
  });

  it("returns a connected snapshot with the read time and no message", async () => {
    const { snap } = await readShopify([shopifyNode()]);
    expect(snap.channel).toBe("shop");
    expect(snap.label).toBe("Shop (products & stock)");
    expect(snap.status).toBe("connected");
    expect(snap.fetchedAt).toBe(NOW.toISOString());
    expect(snap.items).toEqual([]);
    expect(snap.message).toBeUndefined();
    expectNoSecret(snap);
  });

  it("shows zero counts, not missing data, when the shop has no products", async () => {
    const { snap } = await readShopify([]);
    expect(snap.status).toBe("connected");
    expect(snap.products).toEqual([]);
    expect(snap.metrics).toEqual([
      { label: "Products", value: "0" },
      { label: "Low stock", value: "0" },
      { label: "Out of stock", value: "0" },
    ]);
  });

  it("treats an answer without a product list as no products", async () => {
    const { fetchImpl } = recordingFetch([ok({ data: {} })]);
    const snap = await shopSnapshot({ env: shopifyEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("connected");
    expect(snap.products).toEqual([]);
    expect(metric(snap, "Products")).toBe("0");
  });

  it("uses the current time for fetchedAt when no clock is injected", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-06T08:15:00.000Z"));
    const { fetchImpl } = recordingFetch([ok(shopifyAnswer([]))]);
    const snap = await shopSnapshot({ env: shopifyEnv(), fetchImpl });
    expect(snap.fetchedAt).toBe("2026-10-06T08:15:00.000Z");
  });
});

describe("shopSnapshot — Shopify errors", () => {
  it("shows the GraphQL error message when Shopify answers with errors", async () => {
    const { fetchImpl, calls } = recordingFetch([ok({ errors: [{ message: "Access denied", extensions: { code: "ACCESS_DENIED" } }] })]);
    const snap = await shopSnapshot({ env: shopifyEnv(), fetchImpl, now: NOW });
    expect(calls).toHaveLength(1);
    expect(snap.status).toBe("error");
    expect(snap.message).toBe("Access denied");
    expect(snap.fetchedAt).toBe(NOW.toISOString());
    expect(snap.metrics).toEqual([]);
    expect(snap.items).toEqual([]);
    expect(snap.products).toBeUndefined();
    expectNoSecret(snap);
  });

  it("uses the first GraphQL error and ignores any data sent alongside it", async () => {
    const { fetchImpl } = recordingFetch([
      ok({ ...shopifyAnswer([shopifyNode()]), errors: [{ message: "Throttled" }, { message: "Second error" }] }),
    ]);
    const snap = await shopSnapshot({ env: shopifyEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expect(snap.message).toBe("Throttled");
    expect(snap.products).toBeUndefined();
  });

  it("treats an empty errors list as no error", async () => {
    const { fetchImpl } = recordingFetch([ok({ ...shopifyAnswer([shopifyNode()]), errors: [] })]);
    const snap = await shopSnapshot({ env: shopifyEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("connected");
    expect(snap.products).toHaveLength(1);
  });

  it("removes the token if a GraphQL error message repeats it", async () => {
    const { fetchImpl } = recordingFetch([ok({ errors: [{ message: `Invalid token ${TOKEN}` }] })]);
    const snap = await shopSnapshot({ env: shopifyEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expectNoSecret(snap);
  });

  it("explains a refused token (401) in plain language without showing the token", async () => {
    const { fetchImpl } = recordingFetch([{ status: 401, body: { errors: "[API] Invalid API key or access token (unrecognized login or wrong password)" } }]);
    const snap = await shopSnapshot({ env: shopifyEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expect(snap.message).toContain("The access token was refused or has expired");
    expect(snap.message).toContain("401");
    expect(snap.products).toBeUndefined();
    expectNoSecret(snap);
  });

  it("removes the token if Shopify's error message repeats it", async () => {
    const { fetchImpl } = recordingFetch([{ status: 403, body: { message: `Token ${TOKEN} lacks read_products` } }]);
    const snap = await shopSnapshot({ env: shopifyEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expect(snap.message).toContain("does not have permission");
    expect(snap.message).toContain("[redacted]");
    expectNoSecret(snap);
  });

  it("explains an answer that is not JSON", async () => {
    const { fetchImpl } = recordingFetch([ok("<html>Synthetic maintenance page</html>")]);
    const snap = await shopSnapshot({ env: shopifyEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expect(snap.message).toBe("The service sent an answer that could not be read.");
  });

  it("asks the user to wait when rate limited (429)", async () => {
    const { fetchImpl } = recordingFetch([{ status: 429, body: { errors: "Exceeded 2 calls per second for api client." } }]);
    const snap = await shopSnapshot({ env: shopifyEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expect(snap.message).toBe("The service asked us to slow down. Try again in a few minutes.");
  });

  it("explains a network failure without showing the token", async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error(`connect ECONNREFUSED while sending X-Shopify-Access-Token: ${TOKEN}`);
    };
    const snap = await shopSnapshot({ env: shopifyEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expect(snap.message).toContain("Could not reach the service");
    expectNoSecret(snap);
  });

  it("never throws, even when fetch rejects with something that is not an Error", async () => {
    const fetchImpl: FetchLike = () => Promise.reject("synthetic failure");
    const snap = await shopSnapshot({ env: shopifyEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expect(snap.message).toContain("synthetic failure");
    expectNoSecret(snap);
  });
});

describe("shopSnapshot — WooCommerce request", () => {
  it("makes exactly one GET to the products address for published products", async () => {
    const { calls } = await readWoo([]);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(WOO_PRODUCTS);
    expect(calls[0].method).toBe("GET");
    expect(calls[0].body).toBeUndefined();
  });

  it("sends the key and secret only as a Basic Authorization header", async () => {
    const { calls } = await readWoo([]);
    expect(calls[0].headers).toEqual({ Authorization: `Basic ${BASIC}` });
    for (const secret of [KEY, SECRET, BASIC]) expect(calls[0].url).not.toContain(secret);
  });

  it("removes a trailing slash from SHOP_URL", async () => {
    const { calls } = await readWoo([], { SHOP_URL: `${WOO_URL}/` });
    expect(calls[0].url).toBe(WOO_PRODUCTS);
  });

  it("works with a shop installed in a sub-folder", async () => {
    const { calls } = await readWoo([], { SHOP_URL: "https://www.example.com/shop/" });
    expect(calls[0].url).toBe("https://www.example.com/shop/wp-json/wc/v3/products?per_page=100&status=publish");
  });

  it("accepts the platform name in capital letters", async () => {
    const { snap, calls } = await readWoo([], { SHOP_PLATFORM: "WooCommerce" });
    expect(snap.status).toBe("connected");
    expect(calls[0].url).toBe(WOO_PRODUCTS);
  });
});

describe("shopSnapshot — WooCommerce products", () => {
  it("maps a product to the app's product shape", async () => {
    const item = wooItem({
      id: 4321,
      name: "Synthetic Free-Range Eggs (10)",
      price: "95.50",
      stock_status: "instock",
      stock_quantity: 30,
      categories: [
        { id: 21, name: "Synthetic eggs", slug: "synthetic-eggs" },
        { id: 22, name: "Synthetic second category", slug: "synthetic-second" },
      ],
    });
    const { snap } = await readWoo([item]);
    expect(snap.status).toBe("connected");
    expect(snap.products).toEqual([
      {
        id: "woo-4321",
        name: "Synthetic Free-Range Eggs (10)",
        category: "Synthetic eggs",
        status: "Active",
        priceThb: 95.5,
        priceUnit: "per item",
        channels: ["Website"],
        stockStatus: "In stock",
        availability: "Available",
        stockUnits: 30,
        reorderLevel: 5,
        isNew: false,
      },
    ]);
  });

  it('prefixes every id with "woo-"', async () => {
    const { snap } = await readWoo([wooItem({ id: 1 }), wooItem({ id: 202 })]);
    expect(snap.products?.map((p) => p.id)).toEqual(["woo-1", "woo-202"]);
  });

  it('uses "Uncategorised" when there are no categories', async () => {
    const { snap } = await readWoo([wooItem({ categories: [] }), wooItem({ categories: undefined })]);
    expect(snap.products?.map((p) => p.category)).toEqual(["Uncategorised", "Uncategorised"]);
  });

  it("shows an unmanaged product marked outofstock as out of stock", async () => {
    const { snap } = await readWoo([wooItem({ manage_stock: false, stock_quantity: null, stock_status: "outofstock" })]);
    expect(snap.products?.[0]).toMatchObject({ stockStatus: "Out of stock", availability: "Unavailable", stockUnits: 0 });
  });

  it("shows an unmanaged product marked instock or onbackorder as in stock", async () => {
    const { snap } = await readWoo([
      wooItem({ manage_stock: false, stock_quantity: null, stock_status: "instock" }),
      wooItem({ manage_stock: false, stock_quantity: null, stock_status: "onbackorder" }),
      wooItem({ manage_stock: false, stock_quantity: undefined, stock_status: undefined }),
    ]);
    expect(snap.products?.map((p) => [p.stockStatus, p.availability, p.stockUnits])).toEqual([
      ["In stock", "Available", 0],
      ["In stock", "Available", 0],
      ["In stock", "Available", 0],
    ]);
  });

  it("works out stock from stock_quantity with the default low-stock level of 5", async () => {
    const { snap } = await readWoo([
      wooItem({ stock_quantity: 6 }),
      wooItem({ stock_quantity: 5 }),
      wooItem({ stock_quantity: 3 }),
      wooItem({ stock_quantity: 0, stock_status: "outofstock" }),
      wooItem({ stock_quantity: -2, stock_status: "onbackorder" }),
    ]);
    expect(snap.products?.map((p) => [p.stockStatus, p.availability, p.stockUnits, p.reorderLevel])).toEqual([
      ["In stock", "Available", 6, 5],
      ["Low stock", "Limited", 5, 5],
      ["Low stock", "Limited", 3, 5],
      ["Out of stock", "Unavailable", 0, 5],
      ["Out of stock", "Unavailable", -2, 5],
    ]);
  });

  it("respects SHOP_LOW_STOCK", async () => {
    const { snap } = await readWoo([wooItem({ stock_quantity: 12 }), wooItem({ stock_quantity: 13 })], { SHOP_LOW_STOCK: "12" });
    expect(snap.products?.map((p) => [p.stockStatus, p.reorderLevel])).toEqual([
      ["Low stock", 12],
      ["In stock", 12],
    ]);
  });

  it("reads the price as a number", async () => {
    const { snap } = await readWoo([wooItem({ price: "250" }), wooItem({ price: "79.75" }), wooItem({ price: "0" })]);
    expect(snap.products?.map((p) => p.priceThb)).toEqual([250, 79.75, 0]);
  });

  it("leaves products without a price out of the product list", async () => {
    const { snap } = await readWoo([wooItem({ name: "Synthetic priced item" }), wooItem({ price: undefined }), wooItem({ price: "n/a" })]);
    expect(snap.products?.map((p) => p.name)).toEqual(["Synthetic priced item"]);
  });

  it("leaves out a product whose price is empty, instead of showing 0 baht", async () => {
    const { snap } = await readWoo([wooItem({ name: "Synthetic priced item" }), wooItem({ name: "Synthetic unpriced item", price: "" })]);
    expect(snap.products?.map((p) => p.name)).toEqual(["Synthetic priced item"]);
  });

  it("still counts products without a price in the metrics", async () => {
    const { snap } = await readWoo([wooItem(), wooItem({ price: undefined, stock_quantity: 0, stock_status: "outofstock" })]);
    expect(snap.products).toHaveLength(1);
    expect(metric(snap, "Products")).toBe("2");
    expect(metric(snap, "Out of stock")).toBe("1");
  });

  it("counts Products, Low stock and Out of stock", async () => {
    const { snap } = await readWoo([
      wooItem({ stock_quantity: 40 }),
      wooItem({ stock_quantity: 4 }),
      wooItem({ stock_quantity: 1 }),
      wooItem({ stock_quantity: 5 }),
      wooItem({ stock_quantity: null, stock_status: "outofstock" }),
      wooItem({ stock_quantity: 0, stock_status: "outofstock" }),
      wooItem({ stock_quantity: null, stock_status: "instock" }),
    ]);
    expect(snap.metrics).toEqual([
      { label: "Products", value: "7" },
      { label: "Low stock", value: "3" },
      { label: "Out of stock", value: "2" },
    ]);
    expect(snap.fetchedAt).toBe(NOW.toISOString());
    expect(snap.items).toEqual([]);
  });

  it("never puts the key, secret or Basic header value in a connected snapshot", async () => {
    const { snap } = await readWoo([wooItem(), wooItem({ stock_quantity: 0 })]);
    expect(snap.status).toBe("connected");
    expectNoSecret(snap);
  });
});

describe("shopSnapshot — WooCommerce errors", () => {
  it("is an error when the shop does not answer with a list", async () => {
    for (const body of [{ products: [wooItem()] }, { code: "synthetic_code", message: "Synthetic message" }, null, "just text", 42]) {
      const { fetchImpl } = recordingFetch([ok(JSON.stringify(body))]);
      const snap = await shopSnapshot({ env: wooEnv(), fetchImpl, now: NOW });
      expect(snap.status).toBe("error");
      expect(snap.message).toBe("The shop sent an unexpected answer.");
      expect(snap.fetchedAt).toBe(NOW.toISOString());
      expect(snap.metrics).toEqual([]);
      expect(snap.products).toBeUndefined();
      expectNoSecret(snap);
    }
  });

  it("explains an answer that is not JSON (for example a WordPress HTML page)", async () => {
    const { fetchImpl } = recordingFetch([ok("<!doctype html><title>Synthetic page</title>")]);
    const snap = await shopSnapshot({ env: wooEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expect(snap.message).toBe("The service sent an answer that could not be read.");
  });

  it("explains refused keys (401) with WooCommerce's own message and without showing any secret", async () => {
    const { fetchImpl } = recordingFetch([
      { status: 401, body: { code: "woocommerce_rest_cannot_view", message: "Sorry, you cannot list resources.", data: { status: 401 } } },
    ]);
    const snap = await shopSnapshot({ env: wooEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expect(snap.message).toContain("The access token was refused or has expired");
    expect(snap.message).toContain("Sorry, you cannot list resources.");
    expectNoSecret(snap);
  });

  it("removes the key, secret and Basic header value if the error message repeats them", async () => {
    const { fetchImpl } = recordingFetch([
      { status: 401, body: { code: "woocommerce_rest_authentication_error", message: `Bad key ${KEY} / ${SECRET} / ${BASIC}`, data: { status: 401 } } },
    ]);
    const snap = await shopSnapshot({ env: wooEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expect(snap.message).toContain("[redacted]");
    expectNoSecret(snap);
  });

  it("explains a missing products address (404)", async () => {
    const { fetchImpl } = recordingFetch([
      { status: 404, body: { code: "rest_no_route", message: "No route was found matching the URL and request method.", data: { status: 404 } } },
    ]);
    const snap = await shopSnapshot({ env: wooEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expect(snap.message).toContain("was not found");
    expect(snap.message).toContain("No route was found");
  });

  it("explains a network failure without showing any secret", async () => {
    const fetchImpl: FetchLike = async () => {
      throw new Error(`getaddrinfo ENOTFOUND shop.example.com (Authorization: Basic ${BASIC}; key ${KEY}; secret ${SECRET})`);
    };
    const snap = await shopSnapshot({ env: wooEnv(), fetchImpl, now: NOW });
    expect(snap.status).toBe("error");
    expect(snap.message).toContain("Could not reach the service");
    expectNoSecret(snap);
  });
});
