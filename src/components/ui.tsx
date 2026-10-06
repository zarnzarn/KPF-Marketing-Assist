import Link from "next/link";
import type { ReactNode } from "react";
import { DATA_NOT_AVAILABLE } from "@/lib/constants";

// Small reusable building blocks shared by every page.

type Tone = "green" | "gold" | "clay" | "neutral" | "dark";

const toneClass: Record<Tone, string> = {
  green: "bg-forest-soft text-forest border-forest/20",
  gold: "bg-yolk-soft text-[#6b4a05] border-yolk/40",
  clay: "bg-clay-soft text-clay border-clay/30",
  neutral: "bg-white text-muted border-line",
  dark: "bg-forest text-white border-forest",
};

/** Maps any status-like word to a colour so statuses look the same everywhere. */
export function toneFor(value: string): Tone {
  const v = value.toLowerCase();
  if (/(high|overdue|out of stock|at risk|rejected|open|unavailable|declin|low stock|pending)/.test(v)) {
    return /pending|low stock/.test(v) ? "gold" : "clay";
  }
  if (/(active|approved|published|done|in stock|available|ready|completed|resolved|won)/.test(v)) return "green";
  if (/(medium|in progress|in review|scheduled|planned|limited|launching|proposal|qualified|new|draft|coming)/.test(v)) return "gold";
  return "neutral";
}

export function Badge({ children, tone }: { children: string; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${toneClass[tone ?? toneFor(children)]}`}>
      {children}
    </span>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle: string; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-forest sm:text-4xl">{title}</h1>
        <p className="mt-1 max-w-2xl text-base text-muted">{subtitle}</p>
      </div>
      {children}
    </header>
  );
}

export function Card({
  title,
  subtitle,
  href,
  hrefLabel,
  children,
  className = "",
  tone,
  id,
}: {
  title?: string;
  subtitle?: string;
  href?: string;
  hrefLabel?: string;
  children: ReactNode;
  className?: string;
  tone?: "highlight";
  id?: string;
}) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={title ? headingId : undefined}
      className={`min-w-0 rounded-2xl border border-line p-5 shadow-[0_1px_0_rgba(35,32,26,0.04)] ${tone === "highlight" ? "bg-forest text-white" : "bg-card"} ${className}`}
    >
      {title && (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id={headingId} className={`text-xl font-semibold ${tone === "highlight" ? "text-white" : "text-forest"}`}>
              {title}
            </h2>
            {subtitle && <p className={`text-sm ${tone === "highlight" ? "text-white/80" : "text-muted"}`}>{subtitle}</p>}
          </div>
          {href && (
            <Link href={href} className="shrink-0 text-sm font-semibold text-sage underline-offset-4 hover:underline">
              {hrefLabel ?? "View all"}
              <span className="sr-only"> for {title}</span>
            </Link>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: "up" | "down" | "flat" }) {
  const noteColor = tone === "down" ? "text-clay" : tone === "up" ? "text-sage" : "text-muted";
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <p className="text-sm font-medium text-muted">{label}</p>
      <p className="font-display mt-1 text-3xl font-semibold text-forest">{value}</p>
      {note && <p className={`mt-1 text-sm font-medium ${noteColor}`}>{note}</p>}
    </div>
  );
}

export function EmptyState({ children }: { children?: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line bg-white/60 p-4 text-sm text-muted">{children ?? DATA_NOT_AVAILABLE}</p>;
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-line">{children}</ul>;
}

export function ListItem({ children, href }: { children: ReactNode; href?: string }) {
  const body = <div className="flex flex-wrap items-start justify-between gap-2 py-2.5">{children}</div>;
  return (
    <li>
      {href ? (
        <Link href={href} className="block rounded-md hover:bg-forest-soft/50">
          {body}
        </Link>
      ) : (
        body
      )}
    </li>
  );
}

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T>({ caption, columns, rows, rowKey }: { caption: string; columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string }) {
  if (rows.length === 0) return <EmptyState />;
  return (
    <div className="relative overflow-x-auto rounded-xl border border-line" tabIndex={0} role="region" aria-label={`${caption} (scrollable)`}>
      <table className="min-w-full border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-forest-soft text-forest">
          <tr>
            {columns.map((c) => (
              <th key={c.header} scope="col" className={`px-3 py-2.5 text-xs font-semibold tracking-wide uppercase ${c.className ?? ""}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line bg-card">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="align-top">
              {columns.map((c) => (
                <td key={c.header} className={`px-3 py-2.5 ${c.className ?? ""}`}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Horizontal bar list: label, bar and value. Pure CSS, no chart library. */
export function BarList({ items, format }: { items: { label: string; value: number; note?: string }[]; format: (n: number) => string }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">{i.label}</span>
            <span className="font-semibold text-forest">
              {format(i.value)} {i.note && <span className="font-normal text-muted">{i.note}</span>}
            </span>
          </div>
          <div className="mt-1 h-2.5 rounded-full bg-forest-soft" role="presentation">
            <div className="h-2.5 rounded-full bg-sage" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Column chart for monthly trends. Includes a text summary for screen readers. */
export function TrendBars({ points, format, label }: { points: { label: string; value: number }[]; format: (n: number) => string; label: string }) {
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <figure>
      <figcaption className="sr-only">
        {label}: {points.map((p) => `${p.label} ${format(p.value)}`).join(", ")}
      </figcaption>
      <div className="flex h-48 items-stretch gap-3" aria-hidden="true">
        {points.map((p, i) => (
          <div key={p.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div className="flex w-full flex-1 flex-col items-center justify-end gap-1">
              <span className="text-xs font-semibold text-forest">{format(p.value)}</span>
              <div
                className={`w-full rounded-t-md ${i === points.length - 1 ? "bg-yolk" : "bg-sage"}`}
                style={{ height: `${Math.max((p.value / max) * 80, 4)}%` }}
              />
            </div>
            <span className="text-xs text-muted">{p.label}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}

export function ChangeText({ change }: { change: number | null }) {
  if (change === null) return <span className="text-muted">{DATA_NOT_AVAILABLE}</span>;
  const up = change >= 0;
  return (
    <span className={up ? "font-semibold text-sage" : "font-semibold text-clay"}>
      <span aria-hidden="true">{up ? "▲" : "▼"}</span> {Math.abs(change).toFixed(1)}%<span className="sr-only">{up ? " increase" : " decrease"}</span>
    </span>
  );
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="h-2 rounded-full bg-forest-soft" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
        <div className="h-2 rounded-full bg-yolk" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted">{pct}% of budget</p>
    </div>
  );
}
