import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Marketing Director Secretary · Klong Phai Farm",
  description: "Daily command center for the Marketing Director. Uses your own entries, monthly reports and read-only channel data.",
  applicationName: "KPF Secretary",
  robots: { index: false, follow: false }, // a private business tool: keep it out of search engines
};

export const viewport: Viewport = { themeColor: "#1f3d2a" };

/** The outer page only. The protected app (login check, data, menu) is in app/(app)/layout.tsx. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
