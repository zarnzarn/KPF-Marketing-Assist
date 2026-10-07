// Products, prices and stock from the shop, read-only.
// Supports Shopify (Admin GraphQL query, no mutations) and WooCommerce (REST GET).
import { channelConfig, decodeEntities } from "./config";
import { ChannelError, explain, readOnlyJson, redact } from "./readOnlyFetch";
import type { ChannelDeps, ChannelSnapshot } from "./types";
import type { Availability, Product, StockStatus } from "../types";

// Shopify supports each API version for about a year; an older one is quietly served as the oldest supported version.
const SHOPIFY_API = "2026-07";
/** Both shops are read in one page of this size. A full page means there may be more. */
const PAGE_SIZE = 100;

interface ShopRead {
  products: Product[];
  /** True when the shop has more products than one page, so counts are "first 100" only. */
  cutOff: boolean;
}

/** A price as a number, or NaN when it is missing or empty (never an invented 0). */
export function toPrice(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return NaN;
}

export function stockFrom(quantity: number | null | undefined, inStockFlag: boolean | undefined, lowStock: number): { stockStatus: StockStatus; availability: Availability } {
  if (quantity === null || quantity === undefined) {
    return inStockFlag === false ? { stockStatus: "Out of stock", availability: "Unavailable" } : { stockStatus: "In stock", availability: "Available" };
  }
  if (quantity <= 0) return { stockStatus: "Out of stock", availability: "Unavailable" };
  if (quantity <= lowStock) return { stockStatus: "Low stock", availability: "Limited" };
  return { stockStatus: "In stock", availability: "Available" };
}

/** WooCommerce's own stock_status wins; the quantity only separates In stock from Low stock. */
export function wooStock(status: string | undefined, quantity: number | null | undefined, lowStock: number): { stockStatus: StockStatus; availability: Availability } {
  if (status === "outofstock") return { stockStatus: "Out of stock", availability: "Unavailable" };
  // Back-order means the shop has none on hand: never shown as In stock.
  if (status === "onbackorder") return { stockStatus: "Out of stock", availability: "Limited" };
  // No status and no quantity: the shop said nothing about stock, so nothing is claimed.
  if (status === undefined && (quantity === null || quantity === undefined)) return { stockStatus: "Not tracked", availability: "Available" };
  return stockFrom(quantity, true, lowStock);
}

interface ShopifyProduct {
  id: string;
  title: string;
  status: string;
  productType?: string;
  totalInventory?: number | null;
  tracksInventory?: boolean;
  variants?: { nodes?: { price?: string }[] };
}

async function shopifyProducts(host: string, token: string, lowStock: number, deps: ChannelDeps): Promise<ShopRead> {
  const query = `query ReadProducts { products(first: ${PAGE_SIZE}, query: "status:active OR status:draft") { nodes { id title status productType totalInventory tracksInventory variants(first: 1) { nodes { price } } } pageInfo { hasNextPage } } }`;
  const res = await readOnlyJson<{ data?: { products?: { nodes?: ShopifyProduct[]; pageInfo?: { hasNextPage?: boolean } } }; errors?: { message: string }[] }>(`https://${host}/admin/api/${SHOPIFY_API}/graphql.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    secrets: [token],
    fetchImpl: deps.fetchImpl,
  });
  if (res.errors?.length) throw new ChannelError(redact(String(res.errors[0].message ?? "The shop refused the request."), [token]).slice(0, 200), "bad_response");
  const products = (res.data?.products?.nodes ?? []).map((p): Product => {
    // Untracked inventory: Shopify keeps selling it, but there is no count to show.
    const quantity = p.tracksInventory === false ? null : (p.totalInventory ?? null);
    const stock: { stockStatus: StockStatus; availability: Availability } = quantity === null ? { stockStatus: "Not tracked", availability: "Available" } : stockFrom(quantity, undefined, lowStock);
    return {
      id: p.id,
      name: p.title,
      category: p.productType || "Uncategorised",
      status: p.status === "ACTIVE" ? "Active" : p.status === "DRAFT" ? "Draft" : "Paused",
      priceThb: toPrice(p.variants?.nodes?.[0]?.price),
      priceUnit: "price of the first variant",
      channels: ["Website"],
      ...stock,
      stockUnits: quantity,
      reorderLevel: lowStock,
      isNew: false,
    };
  });
  return { products, cutOff: res.data?.products?.pageInfo?.hasNextPage === true };
}

interface WooProduct {
  id: number;
  name: string;
  status: string;
  price?: string;
  stock_status?: string;
  stock_quantity?: number | null;
  categories?: { name: string }[];
}

async function wooProducts(url: string, key: string, secret: string, lowStock: number, deps: ChannelDeps): Promise<ShopRead> {
  const basic = Buffer.from(`${key}:${secret}`).toString("base64");
  const list = await readOnlyJson<WooProduct[]>(`${url}/wp-json/wc/v3/products?per_page=${PAGE_SIZE}&status=publish`, {
    headers: { Authorization: `Basic ${basic}` },
    secrets: [key, secret, basic],
    fetchImpl: deps.fetchImpl,
  });
  if (!Array.isArray(list)) throw new ChannelError("The shop sent an unexpected answer.", "bad_response");
  const products = list.map((p): Product => ({
    id: `woo-${p.id}`,
    // WordPress sends names HTML-escaped ("Eggs &amp; Chicken").
    name: decodeEntities(String(p.name ?? "")),
    category: p.categories?.[0]?.name ? decodeEntities(p.categories[0].name) : "Uncategorised",
    status: "Active",
    priceThb: toPrice(p.price),
    priceUnit: "",
    channels: ["Website"],
    ...wooStock(p.stock_status, p.stock_quantity, lowStock),
    stockUnits: typeof p.stock_quantity === "number" ? p.stock_quantity : null,
    reorderLevel: lowStock,
    isNew: false,
  }));
  return { products, cutOff: list.length >= PAGE_SIZE };
}

/** Checks SHOP_URL before anything is sent, with a message that says what to fix. */
function checkShopUrl(platform: "shopify" | "woocommerce", raw: string): { host: string; url: string } | { problem: string } {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { problem: `SHOP_URL is not a web address. Use the form ${platform === "shopify" ? "https://your-shop.myshopify.com" : "https://www.klongphaifarm.com"}.` };
  }
  if (parsed.protocol !== "https:") return { problem: "SHOP_URL must start with https://" };
  const host = parsed.hostname.toLowerCase();
  if (platform === "shopify" && !/^[a-z0-9-]+\.myshopify\.com$/.test(host)) {
    return { problem: "For Shopify, SHOP_URL must be the shop's own …myshopify.com address (Shopify admin: Settings, Domains), not the public domain." };
  }
  return { host, url: `https://${host}${parsed.port ? `:${parsed.port}` : ""}${parsed.pathname.replace(/\/+$/, "")}` };
}

export async function shopSnapshot(deps: ChannelDeps): Promise<ChannelSnapshot> {
  const { platform, url, key, secret, lowStock } = channelConfig(deps.env).shop;
  const base = { channel: "shop" as const, label: "Shop (products & stock)", metrics: [], items: [] };
  const ready = platform === "shopify" ? url && key : platform === "woocommerce" ? url && key && secret : false;
  if (!ready) return { ...base, status: "not_configured", message: "Add SHOP_PLATFORM (shopify or woocommerce), SHOP_URL and the shop's read-only API key to .env.local." };
  const now = deps.now ?? new Date();
  const checked = checkShopUrl(platform as "shopify" | "woocommerce", url);
  if ("problem" in checked) return { ...base, status: "error", fetchedAt: now.toISOString(), message: checked.problem };
  try {
    const { products, cutOff } = platform === "shopify" ? await shopifyProducts(checked.host, key, lowStock, deps) : await wooProducts(checked.url, key, secret, lowStock, deps);
    const unpriced = products.filter((p) => !Number.isFinite(p.priceThb)).length;
    // Drafts are listed, but only live products count towards stock alerts.
    const live = products.filter((p) => p.status === "Active");
    const note = cutOff ? { note: `first ${PAGE_SIZE} products only` } : {};
    return {
      ...base,
      status: "connected",
      fetchedAt: now.toISOString(),
      metrics: [
        { label: "Products", value: String(products.length), ...note },
        { label: "Low stock", value: String(live.filter((p) => p.stockStatus === "Low stock").length), ...note },
        { label: "Out of stock", value: String(live.filter((p) => p.stockStatus === "Out of stock").length), ...note },
        // Every product is listed (stock alerts need them all); a missing price is shown as "Data not available.".
        ...(unpriced ? [{ label: "Without a price", value: String(unpriced), note: "price shown as Data not available." }] : []),
      ],
      items: [],
      products,
    };
  } catch (error) {
    return { ...base, status: "error", fetchedAt: now.toISOString(), message: explain(error) };
  }
}
