import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppDataProvider } from "@/components/AppDataProvider";
import { AppShell } from "@/components/AppShell";
import { loadChannels } from "@/lib/channels/loadChannels";
import { todayInThailand } from "@/lib/today";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Marketing Director Secretary · Klong Phai Farm",
  description: "Daily command center for the Marketing Director. Uses your own entries, monthly reports and read-only channel data.",
};

// Every visit works out "today" in Thailand, so dates never freeze at build time.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Products come only from the connected shop (read-only). Empty when not connected.
  const shop = (await loadChannels()).find((c) => c.channel === "shop");
  return (
    <html lang="en">
      <body>
        <AppDataProvider today={todayInThailand()} products={shop?.products ?? []} shop={shop ? { status: shop.status, message: shop.message, note: shop.metrics.find((m) => m.label === "Products")?.note } : undefined}>
          <AppShell>{children}</AppShell>
        </AppDataProvider>
      </body>
    </html>
  );
}
