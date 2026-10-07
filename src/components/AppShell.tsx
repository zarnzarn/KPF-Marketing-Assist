"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useAppData } from "@/components/AppDataProvider";
import { signOut } from "@/app/auth/actions";
import { flushSave, loadRemote } from "@/lib/store/userData";
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
  Plug,
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
  { href: "/channels", label: "Channels", icon: Plug },
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
      <p className="mt-4 text-xs leading-relaxed text-muted">Data comes from your own entries, your monthly report files and read-only channel connections.</p>
    </div>
  );
}

function SignOut({ email }: { email: string }) {
  return (
    <form action={signOut} className="flex flex-wrap items-center gap-2 px-6 text-xs text-muted">
      <span className="break-all">Logged in as {email}</span>
      <button type="submit" className="rounded-lg border border-line bg-white px-2.5 py-1 font-semibold text-forest hover:border-yolk">
        Log out
      </button>
    </form>
  );
}

/** Online mode: says whether the last change was saved, in words, so nothing is lost silently. */
function SaveLine() {
  const { saveStatus, online } = useAppData();
  if (!online) return null;
  const text = saveStatus === "saving" ? "Saving…" : saveStatus === "saved" ? "All changes saved" : "";
  return (
    <p role="status" className="px-4 pt-2 text-right text-xs text-muted sm:px-6 lg:px-8">
      {text}
    </p>
  );
}

function SaveProblem() {
  const { saveStatus } = useAppData();
  const box = "border-b border-clay/40 bg-clay-soft px-4 py-2 text-center text-sm font-semibold text-clay";
  if (saveStatus === "local-failed") {
    return (
      <div role="alert" className={box}>
        Your entries could not be saved in this browser (storage is blocked or full). They will be lost when you close or reload this page.
      </div>
    );
  }
  if (saveStatus === "save-failed") {
    return (
      <div role="alert" className={box}>
        Your last change is not saved yet (the database could not be reached).{" "}
        <button type="button" onClick={() => void flushSave()} className="underline underline-offset-4">
          Try again
        </button>
      </div>
    );
  }
  if (saveStatus === "conflict") {
    return (
      <div role="alert" className={box}>
        Your entries were changed on another device. The newest version is now shown; your last change on this device was not saved.{" "}
        <button type="button" onClick={() => void loadRemote()} className="underline underline-offset-4">
          OK
        </button>
      </div>
    );
  }
  return null;
}

export function AppShell({ children, signedInAs }: { children: ReactNode; signedInAs?: string }) {
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
        <div className="mt-auto space-y-4">
          <BrandLinks />
          {signedInAs && <SignOut email={signedInAs} />}
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
            {signedInAs && (
              <div className="mt-3">
                <SignOut email={signedInAs} />
              </div>
            )}
          </nav>
        )}

        <div role="note" className="border-b border-yolk/40 bg-yolk-soft/80 px-4 py-2 text-center text-sm font-medium text-[#5b4004]">
          Read-only: nothing is sent, published, repriced or launched from this app.
        </div>
        <SaveProblem />
        <SaveLine />

        <main id="main" className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
