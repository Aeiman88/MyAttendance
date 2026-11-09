// Date & time helpers. Malaysia is UTC+8 all year (no daylight saving), so a fixed offset is exact
// and the app behaves the same on any server (Vercel runs in UTC) and any phone clock setting.

const OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const MALAY_DAYS = ["Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu", "Ahad"]; // ISO 1..7
export const ENGLISH_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
export const MALAY_MONTHS = [
  "Januari", "Februari", "Mac", "April", "Mei", "Jun",
  "Julai", "Ogos", "September", "Oktober", "November", "Disember",
];
export const ENGLISH_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad = (n: number) => String(n).padStart(2, "0");

/** A Date shifted so its UTC fields read as Malaysian wall-clock time. */
function local(d: Date) {
  return new Date(d.getTime() + OFFSET_MS);
}

/** Malaysian calendar date, "YYYY-MM-DD". */
export function mytDate(d: Date = new Date()): string {
  return local(d).toISOString().slice(0, 10);
}

/** Minutes since local midnight. */
export function mytMinutes(d: Date): number {
  const l = local(d);
  return l.getUTCHours() * 60 + l.getUTCMinutes();
}

/** "08:05" (24-hour). */
export function mytHM(d: Date): string {
  const l = local(d);
  return `${pad(l.getUTCHours())}:${pad(l.getUTCMinutes())}`;
}

/** The instant for a Malaysian date and "HH:MM". */
export function fromMyt(date: string, hm: string): Date {
  return new Date(`${date}T${hm}:00+08:00`);
}

export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

/** "08:23 AM" */
export function fmt12(d: Date, withSeconds = false): string {
  const l = local(d);
  const h24 = l.getUTCHours();
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const s = withSeconds ? `:${pad(l.getUTCSeconds())}` : "";
  return `${pad(h)}:${pad(l.getUTCMinutes())}${s} ${h24 < 12 ? "AM" : "PM"}`;
}

/** "8:00 AM" from "08:00" */
export function hm12(hm: string): string {
  const [h24, m] = hm.split(":").map(Number);
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${pad(m)} ${h24 < 12 ? "AM" : "PM"}`;
}

/** Malay form style: "8:02 pagi", "12:40 tengah hari", "5:15 petang", "8:30 malam". */
export function fmtMalay(d: Date): string {
  const l = local(d);
  const h24 = l.getUTCHours();
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const part = h24 < 12 ? "pagi" : h24 < 14 ? "tengah hari" : h24 < 19 ? "petang" : "malam";
  return `${h}:${pad(l.getUTCMinutes())} ${part}`;
}

/** ISO weekday, 1 = Monday … 7 = Sunday. */
export function isoDow(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

export function addDays(date: string, n: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + n * DAY_MS).toISOString().slice(0, 10);
}

export function mondayOf(date: string): string {
  return addDays(date, 1 - isoDow(date));
}

export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${pad(last)}` };
}

export function currentMonth(): string {
  return mytDate().slice(0, 7);
}

export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/** "4 November 2026" */
export function longDate(date: string, lang: "en" | "ms" = "en"): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${d} ${(lang === "ms" ? MALAY_MONTHS : ENGLISH_MONTHS)[m - 1]} ${y}`;
}

/** "04/11/2026" */
export function dmy(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

export function monthLabel(month: string, lang: "en" | "ms" = "en"): string {
  const [y, m] = month.split("-").map(Number);
  return `${(lang === "ms" ? MALAY_MONTHS : ENGLISH_MONTHS)[m - 1]} ${y}`;
}

/** 12 → "12m", 401 → "6h 41m" */
export function fmtMins(m: number): string {
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`;
}

/** 12 → "12 minit", 401 → "6 jam 41 minit" */
export function fmtMinsMs(m: number): string {
  return m < 60 ? `${m} minit` : `${Math.floor(m / 60)} jam${m % 60 ? ` ${m % 60} minit` : ""}`;
}

/** 492 → "8:12" */
export function fmtDuration(mins: number | null | undefined): string {
  if (mins == null || mins < 0) return "0:00";
  return `${Math.floor(mins / 60)}:${pad(Math.floor(mins % 60))}`;
}

export const isDateStr = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
export const isMonthStr = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}$/.test(s);
export const isHM = (s: unknown): s is string => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
