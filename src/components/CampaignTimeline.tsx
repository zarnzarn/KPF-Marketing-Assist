import { daysBetween, formatDate } from "@/lib/dates";
import type { Campaign } from "@/lib/types";

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const barColor: Record<string, string> = {
  Active: "bg-[#8fbca0]",
  Planned: "bg-[#e6c97f]",
  Draft: "bg-[#d9d0b8]",
  Completed: "bg-[#b9cfc2]",
  Paused: "bg-[#e3a58f]",
};

/** Simple Gantt-style campaign calendar. Each row also has a text description for screen readers. */
export function CampaignTimeline({ campaigns, today }: { campaigns: Campaign[]; today: string }) {
  // The timeline spans from the earliest start to the latest end (always including today).
  const starts = [today, ...campaigns.map((c) => c.startDate)].sort();
  const ends = [today, ...campaigns.map((c) => c.endDate)].sort();
  const rangeStart = `${starts[0].slice(0, 7)}-01`;
  const rangeEnd = ends[ends.length - 1];
  const total = Math.max(daysBetween(rangeStart, rangeEnd), 1);
  const pct = (date: string) => Math.min(100, Math.max(0, (daysBetween(rangeStart, date) / total) * 100));
  const months: { label: string; start: string }[] = [];
  for (let m = rangeStart; m <= rangeEnd && months.length < 24; ) {
    months.push({ label: `${MONTH_NAMES[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`, start: m });
    const [y, mo] = [Number(m.slice(0, 4)), Number(m.slice(5, 7))];
    m = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, "0")}-01`;
  }
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
                <div className="absolute top-[-2px] h-7 w-0.5 bg-clay" style={{ left: `${pct(today)}%` }} aria-hidden="true" />
              </div>
              <span className="sr-only">
                {c.status}, {formatDate(c.startDate)} to {formatDate(c.endDate)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 ml-44 text-xs text-muted">Red line = today. Green = active, gold = planned, grey = draft.</p>
      </div>
    </div>
  );
}
