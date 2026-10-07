// Date helpers. ISO date strings (YYYY-MM-DD) are used everywhere so that
// comparisons are plain string comparisons and there are no timezone surprises.

const MS_PER_DAY = 86_400_000;

function toUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** True only for a real calendar date: "2026-02-28" yes; "2026-02-30", "2026-02-29" (not a leap year) and "2026-13-01" no. */
export function isIsoDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const time = Date.parse(`${date}T00:00:00Z`);
  // Some engines roll 30 Feb forward to 2 Mar, so the date must come back unchanged.
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === date;
}

export function addDays(date: string, days: number): string {
  return new Date(toUtc(date).getTime() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / MS_PER_DAY);
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: string): string {
  const day = toUtc(date).getUTCDay(); // 0 = Sunday
  return addDays(date, day === 0 ? -6 : 1 - day);
}

export function weekDays(date: string): string[] {
  const monday = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

// Date text is built by hand (not Intl) so the server and the browser always
// produce identical output. Different engines format Intl dates slightly
// differently, which would cause React hydration errors.
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function parts(date: string) {
  const d = toUtc(date);
  return { weekday: WEEKDAYS[d.getUTCDay()], day: d.getUTCDate(), month: MONTHS[d.getUTCMonth()], year: d.getUTCFullYear() };
}

export function formatDate(date: string): string {
  const { day, month } = parts(date);
  return `${day} ${month.slice(0, 3)}`;
}

/** "1 - 15 Dec 2026" style ranges always carry the year, so ranges across years are clear. */
export function formatDateRange(from: string, to: string): string {
  const a = parts(from);
  const b = parts(to);
  return a.year === b.year ? `${formatDate(from)} - ${formatDate(to)} ${b.year}` : `${formatDate(from)} ${a.year} - ${formatDate(to)} ${b.year}`;
}

export function formatLongDate(date: string): string {
  const { weekday, day, month, year } = parts(date);
  return `${weekday} ${day} ${month} ${year}`;
}

export function formatWeekday(date: string): string {
  return parts(date).weekday.slice(0, 3);
}

export function formatMonth(month: string): string {
  return MONTHS[Number(month.slice(5, 7)) - 1].slice(0, 3);
}

export function formatThb(value: number): string {
  return `฿${new Intl.NumberFormat("en-US").format(Math.round(value))}`;
}

export function formatCompactThb(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `฿${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `฿${(value / 1_000).toFixed(0)}K`;
  return `฿${Math.round(value)}`;
}
