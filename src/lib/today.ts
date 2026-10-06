/** Today's date (YYYY-MM-DD) in Thailand, where the business runs. */
export function todayInThailand(now: Date = new Date()): string {
  // Thailand is UTC+7 all year (no daylight saving).
  return new Date(now.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
