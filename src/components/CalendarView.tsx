"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MOCK_TODAY } from "@/data/mock";
import { Badge, Card, EmptyState } from "@/components/ui";
import { addDays, formatDate, formatLongDate, formatWeekday, weekDays } from "@/lib/dates";
import type { CalendarItem, CalendarItemType } from "@/lib/types";

type View = "day" | "week" | "marketing";

const typeStyle: Record<CalendarItemType, string> = {
  Meeting: "border-l-forest bg-forest-soft",
  Event: "border-l-clay bg-clay-soft",
  "Campaign milestone": "border-l-yolk bg-yolk-soft",
  "Content deadline": "border-l-sage bg-white",
  "Follow-up": "border-l-[#8a7f66] bg-white",
};

const types = Object.keys(typeStyle) as CalendarItemType[];

function Entry({ item }: { item: CalendarItem }) {
  return (
    <Link href={item.href} className={`block rounded-lg border border-line border-l-4 p-2 text-sm hover:shadow-sm ${typeStyle[item.type]}`}>
      <span className="block text-xs font-semibold text-muted">{item.start ? `${item.start}–${item.end}` : item.type}</span>
      <span className="block leading-snug font-medium">{item.title}</span>
    </Link>
  );
}

export function CalendarView({ items }: { items: CalendarItem[] }) {
  const [view, setView] = useState<View>("day");
  const [date, setDate] = useState(MOCK_TODAY);
  const step = view === "week" ? 7 : 1;
  const on = (d: string) => items.filter((i) => i.date === d);
  const marketing = items.filter((i) => i.type !== "Meeting" && i.date >= MOCK_TODAY);

  const tabs: { id: View; label: string }[] = [
    { id: "day", label: "Day" },
    { id: "week", label: "Week" },
    { id: "marketing", label: "Marketing calendar" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Calendar view" className="inline-flex overflow-hidden rounded-xl border border-line bg-white">
          {tabs.map((t) => (
            <button key={t.id} type="button" aria-pressed={view === t.id} onClick={() => setView(t.id)} className={`px-4 py-2 text-sm font-semibold ${view === t.id ? "bg-forest text-white" : "hover:bg-forest-soft"}`}>
              {t.label}
            </button>
          ))}
        </div>
        {view !== "marketing" && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setDate(addDays(date, -step))} className="rounded-lg border border-line bg-white p-2 hover:border-yolk">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Previous {view}</span>
            </button>
            <button type="button" onClick={() => setDate(MOCK_TODAY)} className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-semibold hover:border-yolk">Today</button>
            <button type="button" onClick={() => setDate(addDays(date, step))} className="rounded-lg border border-line bg-white p-2 hover:border-yolk">
              <ChevronRight className="h-4 w-4" aria-hidden="true" /><span className="sr-only">Next {view}</span>
            </button>
          </div>
        )}
      </div>

      <ul className="flex flex-wrap gap-2" aria-label="Legend">
        {types.map((t) => (
          <li key={t} className={`rounded-md border border-line border-l-4 px-2 py-1 text-xs font-medium ${typeStyle[t]}`}>{t}</li>
        ))}
      </ul>

      {view === "day" && (
        <Card id="day" title={formatLongDate(date)} subtitle={date === MOCK_TODAY ? "Today (mock date)" : undefined}>
          {on(date).length === 0 ? <EmptyState>Nothing scheduled.</EmptyState> : <div className="space-y-2">{on(date).map((i) => <Entry key={i.id} item={i} />)}</div>}
        </Card>
      )}

      {view === "week" && (
        <Card id="week" title={`Week of ${formatDate(weekDays(date)[0])}`}>
          <ol className="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
            {weekDays(date).map((d) => (
              <li key={d} className={`min-w-0 rounded-xl border p-2 ${d === MOCK_TODAY ? "border-yolk bg-yolk-soft/40" : "border-line bg-white"}`}>
                <h3 className="mb-2 text-sm font-semibold text-forest">
                  {formatWeekday(d)} {formatDate(d)} {d === MOCK_TODAY && <Badge tone="gold">Today</Badge>}
                </h3>
                <div className="space-y-2">
                  {on(d).length === 0 ? <p className="text-xs text-muted">—</p> : on(d).map((i) => <Entry key={i.id} item={i} />)}
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {view === "marketing" && (
        <Card id="marketing" title="Marketing calendar" subtitle="Events, campaign milestones, content deadlines and follow-ups from today onwards">
          <ul className="divide-y divide-line">
            {marketing.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="w-20 shrink-0 text-sm font-semibold text-forest">{formatDate(i.date)}</span>
                <Link href={i.href} className="min-w-0 flex-1 font-medium hover:underline">{i.title}</Link>
                <Badge tone="neutral">{i.type}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
