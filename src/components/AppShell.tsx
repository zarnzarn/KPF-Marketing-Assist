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
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors ${
                active ? "bg-yolk text-forest" : "text-white/90 hover:bg-white/10"
              }`}
            >
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Brand() {
  return (
    <div className="px-3">
      <p className="font-display text-xl leading-tight font-semibold text-white">Klong Phai Farm</p>
      <p className="text-sm text-yolk">Marketing Director Secretary</p>
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
      <aside className="hidden w-64 shrink-0 flex-col gap-6 bg-forest py-6 lg:flex lg:sticky lg:top-0 lg:h-screen lg:overflow-y-auto" aria-label="Sidebar">
        <Brand />
        <nav aria-label="Main">
          <div className="px-3">
            <NavLinks />
          </div>
        </nav>
        <p className="mt-auto px-6 text-xs leading-relaxed text-white/70">Phase 1 prototype. All data on screen is mock data.</p>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile / tablet top bar */}
        <div className="sticky top-0 z-30 flex items-center justify-between bg-forest px-4 py-3 lg:hidden">
          <Brand />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="rounded-lg p-2 text-white hover:bg-white/10"
          >
            {open ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
            <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
          </button>
        </div>
        {open && (
          <nav id="mobile-nav" aria-label="Main" className="bg-forest px-3 pb-4 lg:hidden">
            <NavLinks onNavigate={() => setOpen(false)} />
          </nav>
        )}

        <div role="note" className="border-b border-yolk/40 bg-yolk-soft px-4 py-2 text-center text-sm font-medium text-[#5b4004]">
          PROTOTYPE · MOCK DATA ONLY · Nothing is sent, published, repriced or launched from this app.
        </div>

        <main id="main" className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
