// Products, prices and stock from the shop, read-only.
// Supports Shopify (Admin GraphQL query, no mutations) and WooCommerce (REST GET).
import { channelConfig } from "./config";
import { ChannelError, explain, readOnlyJson, redact } from "./readOnlyFetch";
import type { ChannelDeps, ChannelSnapshot } from "./types";
import type { Availability, Product, StockStatus } from "../types";

const SHOPIFY_API = "2025-01";

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

interface ShopifyProduct {
  id: string;
  title: string;
  status: string;
  productType?: string;
  totalInventory?: number | null;
  tracksInventory?: boolean;
  variants?: { nodes?: { price?: string }[] };
}

async function shopifyProducts(url: string, token: string, lowStock: number, deps: ChannelDeps): Promise<Product[]> {
  const host = url.replace(/^https?:\/\//, "");
  const query = "query ReadProducts { products(first: 100, query: \"status:active OR status:draft\") { nodes { id title status productType totalInventory tracksInventory variants(first: 1) { nodes { price } } } } }";
  const res = await readOnlyJson<{ data?: { products?: { nodes?: ShopifyProduct[] } }; errors?: { message: string }[] }>(`https://${host}/admin/api/${SHOPIFY_API}/graphql.json`, {
    method: "POST",
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    secrets: [token],
    fetchImpl: deps.fetchImpl,
  });
  if (res.errors?.length) throw new ChannelError(redact(String(res.errors[0].message ?? "The shop refused the request."), [token]).slice(0, 200), "bad_response");
  return (res.data?.products?.nodes ?? []).map((p) => {
    const stock = p.tracksInventory === false ? stockFrom(undefined, true, lowStock) : stockFrom(p.totalInventory, undefined, lowStock);
    return {
      id: p.id,
      name: p.title,
      category: p.productType || "Uncategorised",
      status: p.status === "ACTIVE" ? "Active" : "Paused",
      priceThb: toPrice(p.variants?.nodes?.[0]?.price),
      priceUnit: "per item",
      channels: ["Website"],
      ...stock,
      stockUnits: p.totalInventory ?? 0,
      reorderLevel: lowStock,
      isNew: false,
    };
  });
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

async function wooProducts(url: string, key: string, secret: string, lowStock: number, deps: ChannelDeps): Promise<Product[]> {
  const basic = Buffer.from(`${key}:${secret}`).toString("base64");
  const list = await readOnlyJson<WooProduct[]>(`${url}/wp-json/wc/v3/products?per_page=100&status=publish`, {
    headers: { Authorization: `Basic ${basic}` },
    secrets: [key, secret, basic],
    fetchImpl: deps.fetchImpl,
  });
  if (!Array.isArray(list)) throw new ChannelError("The shop sent an unexpected answer.", "bad_response");
  return list.map((p) => {
    const stock = stockFrom(p.stock_quantity, p.stock_status !== "outofstock", lowStock);
    return {
      id: `woo-${p.id}`,
      name: p.name,
      category: p.categories?.[0]?.name ?? "Uncategorised",
      status: "Active",
      priceThb: toPrice(p.price),
      priceUnit: "per item",
      channels: ["Website"],
      ...stock,
      stockUnits: p.stock_quantity ?? 0,
      reorderLevel: lowStock,
      isNew: false,
    };
  });
}

export async function shopSnapshot(deps: ChannelDeps): Promise<ChannelSnapshot> {
  const { platform, url, key, secret, lowStock } = channelConfig(deps.env).shop;
  const base = { channel: "shop" as const, label: "Shop (products & stock)", metrics: [], items: [] };
  const ready = platform === "shopify" ? url && key : platform === "woocommerce" ? url && key && secret : false;
  if (!ready) return { ...base, status: "not_configured", message: "Add SHOP_PLATFORM (shopify or woocommerce), SHOP_URL and the shop's read-only API key to .env.local." };
  const now = deps.now ?? new Date();
  try {
    if (!/^https:\/\//.test(url)) throw new ChannelError("SHOP_URL must start with https://", "blocked");
    const products = platform === "shopify" ? await shopifyProducts(url, key, lowStock, deps) : await wooProducts(url, key, secret, lowStock, deps);
    const valid = products.filter((p) => Number.isFinite(p.priceThb));
    return {
      ...base,
      status: "connected",
      fetchedAt: now.toISOString(),
      metrics: [
        { label: "Products", value: String(products.length) },
        { label: "Low stock", value: String(products.filter((p) => p.stockStatus === "Low stock").length) },
        { label: "Out of stock", value: String(products.filter((p) => p.stockStatus === "Out of stock").length) },
        // Products without a price are counted above but left out of the list, so say so.
        ...(products.length > valid.length ? [{ label: "Without a price", value: String(products.length - valid.length), note: "not shown in the product list" }] : []),
      ],
      items: [],
      products: valid,
    };
  } catch (error) {
    return { ...base, status: "error", fetchedAt: now.toISOString(), message: explain(error) };
  }
}
