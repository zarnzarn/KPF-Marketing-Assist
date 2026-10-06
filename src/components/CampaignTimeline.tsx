import { MOCK_TODAY } from "@/data/mock";
import { daysBetween, formatDate } from "@/lib/dates";
import type { Campaign } from "@/lib/types";

const RANGE_START = "2026-09-15";
const RANGE_END = "2026-12-31";
const total = daysBetween(RANGE_START, RANGE_END);

const pct = (date: string) => Math.min(100, Math.max(0, (daysBetween(RANGE_START, date) / total) * 100));

const barColor: Record<string, string> = {
  Active: "bg-[#8fbca0]",
  Planned: "bg-[#e6c97f]",
  Draft: "bg-[#d9d0b8]",
  Completed: "bg-[#b9cfc2]",
  Paused: "bg-[#e3a58f]",
};

/** Simple Gantt-style campaign calendar. Each row also has a text description for screen readers. */
export function CampaignTimeline({ campaigns }: { campaigns: Campaign[] }) {
  const months = [
    { label: "Oct 2026", start: "2026-10-01" },
    { label: "Nov 2026", start: "2026-11-01" },
    { label: "Dec 2026", start: "2026-12-01" },
  ];
  return (
    <div className="relative overflow-x-auto">
      <div className="min-w-[640px]">
        <div className="relative ml-44 h-6 border-b border-line text-xs font-semibold text-muted" aria-hidden="true">
          {months.map((m) => (
            <span key={m.label} className="absolute -translate-x-0" style={{ left: `${pct(m.start)}%` }}>
              {m.label}
            </span>
          ))}
        </div>
        <ul className="relative">
          {campaigns.map((c) => (
            <li key={c.id} className="flex items-center gap-3 border-b border-line/60 py-2">
              <span className="w-40 shrink-0 text-sm font-medium">{c.name}</span>
              <div className="relative h-6 flex-1 rounded bg-forest-soft/60">
                <div
                  className={`absolute top-0 h-6 rounded ${barColor[c.status]}`}
                  style={{ left: `${pct(c.startDate)}%`, width: `${Math.max(pct(c.endDate) - pct(c.startDate), 2)}%` }}
                />
                <div className="absolute top-[-2px] h-7 w-0.5 bg-clay" style={{ left: `${pct(MOCK_TODAY)}%` }} aria-hidden="true" />
              </div>
              <span className="sr-only">
                {c.status}, {formatDate(c.startDate)} to {formatDate(c.endDate)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 ml-44 text-xs text-muted">Red line = today (mock). Green = active, gold = planned, grey = draft.</p>
      </div>
    </div>
  );
}
