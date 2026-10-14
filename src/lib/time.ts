import { site } from "./config";

/** Current calendar date (YYYY-MM-DD) and hour (0-23) in the club's timezone. */
export function nowInClubTz(): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: site.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function endOfMonth(dateStr: string): string {
  const [yearStr, monthStr] = dateStr.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr); // 1-indexed (e.g. 10 for October)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${yearStr}-${monthStr.padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function formatSingleHour(h: number): string {
  const norm = h % 24;
  const suffix = norm >= 12 ? "PM" : "AM";
  const display = norm % 12 || 12;
  return `${display}:00 ${suffix}`;
}

export function formatHour(h: number): string {
  // Format as 1-hour interval, e.g. 8:00 AM – 9:00 AM
  const start = formatSingleHour(h);
  const end = formatSingleHour(h + 1);
  return `${start} – ${end}`;
}

export function formatDateLabel(date: string, opts?: Intl.DateTimeFormatOptions): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const d = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    ...opts,
  }).format(d);
}
