"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  BarChart3,
  Bot,
  CalendarDays,
  CheckSquare,
  FileText,
  Megaphone,
  Menu,
  NotebookPen,
  Package,
  PenLine,
  Sparkles,
  Sun,
  Users,
  X,
  ClipboardList,
  Leaf,
  ExternalLink,
} from "lucide-react";

export const navItems = [
  { href: "/", label: "Today", icon: Sun },
  { href: "/secretary", label: "AI Secretary", icon: Bot },
  { href: "/marketing", label: "Marketing", icon: Megaphone },
  { href: "/sales", label: "Sales", icon: BarChart3 },
  { href: "/products", label: "Products", icon: Package },
  { href: "/customers", label: "Customers & B2B", icon: Users },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/meetings", label: "Meetings", icon: NotebookPen },
  { href: "/campaigns", label: "Campaigns", icon: Sparkles },
  { href: "/content", label: "Content", icon: PenLine },
  { href: "/reports", label: "Reports", icon: ClipboardList },
  { href: "/documents", label: "Documents", icon: FileText },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-1">
      {navItems.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] font-medium transition-colors ${
                active ? "bg-yolk-soft text-forest shadow-sm ring-1 ring-yolk/60" : "text-ink hover:bg-white/70"
              }`}
            >
              <Icon className={`h-[18px] w-[18px] ${active ? "text-forest" : "text-sage"}`} aria-hidden="true" />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

const brandLinks = [
  { label: "Website", href: "https://www.klongphaifarm.com/" },
  { label: "Facebook", href: "https://www.facebook.com/Klongphaifarm/" },
  { label: "Instagram", href: "https://www.instagram.com/klongphaifarm3196/" },
  { label: "LINE OA", href: "https://line.me/R/ti/p/~lin.ee/679zHJ1" },
];

function Brand() {
  return (
    <div className="flex items-center gap-3 px-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-yolk-soft text-forest ring-1 ring-yolk/50" aria-hidden="true">
        <Leaf className="h-6 w-6" />
      </span>
      <div>
        <p className="font-display text-xl leading-tight font-semibold text-forest">Klong Phai Farm</p>
        <p className="text-sm text-muted">Marketing Director Secretary</p>
      </div>
    </div>
  );
}

function BrandLinks() {
  return (
    <div className="px-6">
      <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-sage uppercase">Brand channels</p>
      <ul className="space-y-1">
        {brandLinks.map((l) => (
          <li key={l.href}>
            <a href={l.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-ink underline-offset-4 hover:underline">
              {l.label}
              <ExternalLink className="h-3 w-3 text-sage" aria-hidden="true" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs leading-relaxed text-muted">Phase 1 prototype. All data on screen is mock data. These are plain links, nothing is connected.</p>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-yolk focus:px-3 focus:py-2 focus:text-forest">
        Skip to main content
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden w-72 shrink-0 flex-col gap-6 border-r border-line bg-sidebar py-7 lg:sticky lg:top-0 lg:flex lg:h-screen lg:overflow-y-auto" aria-label="Sidebar">
        <Brand />
        <nav aria-label="Main">
          <div className="px-3">
            <NavLinks />
          </div>
        </nav>
        <div className="mt-auto">
          <BrandLinks />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile / tablet top bar */}
        <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-sidebar px-4 py-3 lg:hidden">
          <Brand />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="rounded-xl p-2 text-forest hover:bg-white/70"
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
        {open && (
          <nav id="mobile-nav" aria-label="Main" className="border-b border-line bg-sidebar px-3 pb-4 lg:hidden">
            <NavLinks onNavigate={() => setOpen(false)} />
          </nav>
        )}

        <div role="note" className="border-b border-yolk/40 bg-yolk-soft/80 px-4 py-2 text-center text-sm font-medium text-[#5b4004]">
          PROTOTYPE · MOCK DATA ONLY · Nothing is sent, published, repriced or launched from this app.
        </div>

        <main id="main" className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
