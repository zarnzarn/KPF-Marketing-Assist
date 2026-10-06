// Beginner-friendly connection steps shown on the Channels page.
// Settings go in .env.local (never committed). Restart the app after editing it.
import type { ChannelId } from "./types";

export const setupSteps: Record<ChannelId, { summary: string; steps: string[]; env: string[] }> = {
  website: {
    summary: "Nothing to set up. The app reads your public website pages (home page and sitemap).",
    steps: ["Optional: set WEBSITE_URL if the address ever changes."],
    env: ["WEBSITE_URL=https://www.klongphaifarm.com"],
  },
  ga4: {
    summary: "Visitors and traffic sources from Google Analytics 4, Thailand only. Read-only.",
    steps: [
      "In Google Cloud Console, create a project and turn on the “Google Analytics Data API”.",
      "Create a service account, then create a JSON key for it.",
      "Save the key file OUTSIDE the project folder, for example D:/Keys/ga4-key.json. Never put it inside the project.",
      "In Google Analytics: Admin, Property access management, add the service account's email as Viewer.",
      "In Google Analytics: Admin, Property details, copy the Property ID (numbers only).",
    ],
    env: ["GA4_PROPERTY_ID=123456789", "GA4_SERVICE_ACCOUNT_JSON_PATH=D:/Keys/ga4-key.json"],
  },
  shop: {
    summary: "Products, prices and stock from your online shop. Read-only: prices are never changed from this app.",
    steps: [
      "Tell us which platform the shop runs on (Shopify or WooCommerce). Other platforms are not supported yet.",
      "Shopify: Settings, Apps and sales channels, Develop apps, create an app with ONLY the read_products and read_inventory scopes, install it, then copy the Admin API access token.",
      "WooCommerce: WooCommerce, Settings, Advanced, REST API, Add key with Permissions set to Read, then copy the consumer key and secret.",
    ],
    env: ["SHOP_PLATFORM=shopify  (or woocommerce)", "SHOP_URL=https://your-shop.myshopify.com  (or https://www.klongphaifarm.com)", "SHOP_API_KEY=...", "SHOP_API_SECRET=...  (WooCommerce only)", "SHOP_LOW_STOCK=5  (optional)"],
  },
  facebook: {
    summary: "Followers, page likes and recent posts from the Klong Phai Farm Facebook Page. Read-only.",
    steps: [
      "Go to developers.facebook.com, create an app (type: Business).",
      "In Graph API Explorer, choose your app and the Klong Phai Farm Page, and request pages_show_list and pages_read_engagement only.",
      "Create a Page access token and turn it into a long-lived token (Access Token Debugger, Extend).",
      "Copy the Page ID (Page, About, Page transparency).",
    ],
    env: ["META_PAGE_ID=...", "META_PAGE_ACCESS_TOKEN=..."],
  },
  instagram: {
    summary: "Followers and recent posts from @klongphaifarm3196. Read-only.",
    steps: [
      "Instagram must be a Professional (Business or Creator) account linked to the Facebook Page.",
      "Add the instagram_basic permission to the same Meta token as Facebook.",
      "In Graph API Explorer run: me/accounts?fields=instagram_business_account and copy the id shown.",
    ],
    env: ["META_IG_USER_ID=...", "META_PAGE_ACCESS_TOKEN=...  (same as Facebook)"],
  },
  line: {
    summary: "Friends, targeted reach and blocks for the LINE Official Account. Read-only: no messages are ever sent.",
    steps: [
      "The lin.ee link is only an invite link. A channel access token is needed.",
      "In LINE Official Account Manager: Settings, Messaging API, enable it (this creates a channel).",
      "In LINE Developers console: open that channel, Messaging API tab, issue a long-lived channel access token.",
      "LINE only prepares friend statistics for accounts with enough friends; otherwise it shows Data not available.",
    ],
    env: ["LINE_CHANNEL_ACCESS_TOKEN=..."],
  },
};
