import type { ReactNode } from "react";
import { AppDataProvider } from "@/components/AppDataProvider";
import { AppShell } from "@/components/AppShell";
import { requireViewer } from "@/lib/auth/session";
import { viewerChannels } from "@/lib/data/server";
import { supabaseSettings } from "@/lib/mode";
import { todayInThailand } from "@/lib/today";

// Every visit works out "today" in Thailand and checks the login, so nothing is built ahead of time.
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Nothing below is read or shown unless the allowed user is logged in (or the app runs locally).
  const viewer = await requireViewer();
  const settings = supabaseSettings();
  // Products come only from the connected shop (read-only). Empty when not connected.
  const shop = (await viewerChannels()).find((c) => c.channel === "shop");
  return (
    <AppDataProvider
      today={todayInThailand()}
      products={shop?.products ?? []}
      shop={shop ? { status: shop.status, message: shop.message, note: shop.metrics.find((m) => m.label === "Products")?.note } : undefined}
      remote={viewer.mode === "online" && settings ? { ...settings, userId: viewer.userId } : undefined}
    >
      <AppShell signedInAs={viewer.mode === "online" ? viewer.email : undefined}>{children}</AppShell>
    </AppDataProvider>
  );
}
