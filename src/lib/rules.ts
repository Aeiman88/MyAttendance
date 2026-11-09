// Attendance rules shared by the server (history, print, admin) and the browser (today card).
import { ENGLISH_DAYS, MALAY_DAYS, fmtMinsMs, fromMyt, hmToMinutes, isoDow, mytMinutes } from "./time";

export type Schedule = {
  id: number;
  code: string;
  name: string;
  start_time: string;
  end_time: string;
  grace_minutes: number;
  work_days: number[];
};

export type RequestType = "cuti" | "mc" | "kursus" | "tugas_luar" | "pembetulan" | "lain";

export const REQUEST_TYPES: Record<RequestType, { en: string; ms: string; hint: string; range: boolean }> = {
  cuti: { en: "Annual leave", ms: "Cuti Rehat", hint: "Planned leave days", range: true },
  mc: { en: "Medical leave (MC)", ms: "Cuti Sakit (MC)", hint: "Hand the MC slip to the admin", range: true },
  kursus: { en: "Course or workshop", ms: "Kursus", hint: "Training you attend away from DAICOE", range: true },
  tugas_luar: { en: "Official duty outside", ms: "Tugas Luar", hint: "Work at another school or office", range: true },
  pembetulan: { en: "Time correction", ms: "Pembetulan Masa", hint: "Forgot to clock in or out, or a wrong time", range: false },
  lain: { en: "Other", ms: "Lain-lain", hint: "Anything else the admin should note", range: true },
};
export const REQUEST_TYPE_KEYS = Object.keys(REQUEST_TYPES) as RequestType[];

export type Leave = { id: number; type: RequestType; date_from: string; date_to: string; reason: string };

export type RecordRow = {
  id: number;
  staff_id: number;
  work_date: string;
  clock_in: Date | string | null;
  clock_out: Date | string | null;
  in_lat: number | null;
  in_lng: number | null;
  in_accuracy: number | null;
  in_zone: "internal" | "external" | null;
  in_zone_name: string | null;
  in_distance_m: number | null;
  in_note: string | null;
  in_device?: string | null;
  out_lat: number | null;
  out_lng: number | null;
  out_accuracy: number | null;
  out_zone: "internal" | "external" | null;
  out_zone_name: string | null;
  out_distance_m: number | null;
  out_note: string | null;
  out_device?: string | null;
  remark: string | null;
  source: "app" | "manual" | "request";
};

export type DayStatus =
  | "present" // clocked in and out
  | "working" // today, clocked in, not out yet
  | "incomplete" // a past day with a missing clock-in or clock-out
  | "absent" // past work day, nothing recorded, no leave
  | "leave" // approved request covers the day
  | "holiday" // public holiday
  | "off" // not a work day for this schedule (weekend)
  | "pending" // today, not clocked in yet
  | "upcoming" // future day
  | "untracked"; // before this staff member started using the app

export type DayFlag = "late" | "early" | "external" | "corrected" | "manual";

export type DayView = {
  date: string;
  dow: number;
  dayMs: string;
  dayEn: string;
  workday: boolean;
  holiday: string | null;
  leave: { type: RequestType; label: string; reason: string } | null;
  record: RecordRow | null;
  clockIn: string | null; // ISO
  clockOut: string | null; // ISO
  workedMins: number | null;
  lateMins: number;
  earlyMins: number;
  status: DayStatus;
  flags: DayFlag[];
  remarkMs: string;
};

const iso = (v: Date | string | null) => (v == null ? null : v instanceof Date ? v.toISOString() : new Date(v).toISOString());

export function scheduleMinutes(s: Schedule | null) {
  if (!s) return null;
  return { start: hmToMinutes(s.start_time), end: hmToMinutes(s.end_time), grace: s.grace_minutes };
}

export function lateBy(clockIn: Date, s: Schedule | null): number {
  const m = scheduleMinutes(s);
  if (!m) return 0;
  const inMin = mytMinutes(clockIn);
  return inMin > m.start + m.grace ? inMin - m.start : 0;
}

export function earlyBy(clockOut: Date, s: Schedule | null): number {
  const m = scheduleMinutes(s);
  if (!m) return 0;
  const outMin = mytMinutes(clockOut);
  return outMin < m.end ? m.end - outMin : 0;
}

export function workedMinutes(clockIn: Date | null, clockOut: Date | null, now = new Date()): number | null {
  if (!clockIn) return null;
  const end = clockOut ?? now;
  return Math.max(0, Math.floor((end.getTime() - clockIn.getTime()) / 60000));
}

/** Scheduled length of the working day in minutes (used for the progress ring). */
export function scheduledLength(s: Schedule | null): number {
  const m = scheduleMinutes(s);
  return m ? Math.max(60, m.end - m.start) : 9 * 60;
}

export function buildDay(input: {
  date: string;
  today: string;
  trackingStart: string;
  schedule: Schedule | null;
  holiday: string | null;
  leaves: Leave[];
  record: RecordRow | null;
}): DayView {
  const { date, today, trackingStart, schedule, holiday, record } = input;
  const dow = isoDow(date);
  const workday = schedule ? schedule.work_days.includes(dow) : dow <= 5;
  const lv = input.leaves.find((l) => l.type !== "pembetulan" && l.date_from <= date && l.date_to >= date) ?? null;
  const leave = lv ? { type: lv.type, label: REQUEST_TYPES[lv.type].ms, reason: lv.reason } : null;

  const cin = record?.clock_in ? new Date(record.clock_in) : null;
  const cout = record?.clock_out ? new Date(record.clock_out) : null;
  const countsForTiming = workday && !holiday && !leave;
  const lateMins = cin && countsForTiming ? lateBy(cin, schedule) : 0;
  const earlyMins = cout && countsForTiming ? earlyBy(cout, schedule) : 0;
  const workedMins = cin && cout ? workedMinutes(cin, cout) : cin && date === today ? workedMinutes(cin, null) : null;

  let status: DayStatus;
  if (cin && cout) status = "present";
  else if (cin && date === today) status = "working";
  else if (cin || cout) status = date < today ? "incomplete" : "working";
  else if (date > today) status = "upcoming";
  else if (holiday) status = "holiday";
  else if (leave) status = "leave";
  else if (!workday) status = "off";
  else if (date < trackingStart) status = "untracked";
  else if (date === today) status = "pending";
  else status = "absent";
  if (status === "upcoming" && (holiday || leave)) status = holiday ? "holiday" : "leave";

  const flags: DayFlag[] = [];
  if (lateMins > 0) flags.push("late");
  if (earlyMins > 0) flags.push("early");
  if (record && (record.in_zone === "external" || record.out_zone === "external")) flags.push("external");
  if (record?.source === "request") flags.push("corrected");
  if (record?.source === "manual") flags.push("manual");

  return {
    date,
    dow,
    dayMs: MALAY_DAYS[dow - 1],
    dayEn: ENGLISH_DAYS[dow - 1],
    workday,
    holiday,
    leave,
    record,
    clockIn: iso(record?.clock_in ?? null),
    clockOut: iso(record?.clock_out ?? null),
    workedMins,
    lateMins,
    earlyMins,
    status,
    flags,
    remarkMs: malayRemark({ holiday, leave, record, status, lateMins, earlyMins }),
  };
}

/** Text for the "Perkara Khas" column of the printed form. */
function malayRemark(d: {
  holiday: string | null;
  leave: DayView["leave"];
  record: RecordRow | null;
  status: DayStatus;
  lateMins: number;
  earlyMins: number;
}): string {
  const parts: string[] = [];
  if (d.holiday) parts.push(`Cuti Umum: ${d.holiday}`);
  if (d.leave) {
    const withReason = d.leave.type === "kursus" || d.leave.type === "tugas_luar" || d.leave.type === "lain";
    const reason = d.leave.reason?.trim() ?? "";
    if (!withReason || !reason) parts.push(d.leave.label);
    else if (d.leave.type === "lain" || reason.toLowerCase().startsWith(d.leave.label.toLowerCase())) parts.push(reason);
    else parts.push(`${d.leave.label}: ${reason}`);
  }
  const r = d.record;
  if (r) {
    const inExt = r.in_zone === "external";
    const outExt = r.out_zone === "external";
    if (inExt && outExt && (r.in_note ?? "") === (r.out_note ?? "")) {
      parts.push(`Luar kawasan${r.in_note ? `: ${r.in_note}` : ""}`);
    } else {
      if (inExt) parts.push(`Masuk luar kawasan${r.in_note ? `: ${r.in_note}` : ""}`);
      if (outExt) parts.push(`Balik luar kawasan${r.out_note ? `: ${r.out_note}` : ""}`);
    }
    if (d.lateMins > 0) parts.push(`Lewat ${fmtMinsMs(d.lateMins)}`);
    if (d.earlyMins > 0) parts.push(`Balik awal ${fmtMinsMs(d.earlyMins)}`);
    if (d.status === "incomplete") parts.push(r.clock_in ? "Tiada rekod balik" : "Tiada rekod datang");
    if (r.source === "request") parts.push("Pembetulan masa diluluskan");
    if (r.source === "manual") parts.push("Direkod oleh admin");
    if (r.remark) parts.push(r.remark);
  } else if (d.status === "absent") {
    parts.push("Tidak hadir");
  }
  return parts.join("; ");
}

export const STATUS_LABEL: Record<DayStatus, string> = {
  present: "Present",
  working: "Working",
  incomplete: "Incomplete",
  absent: "Absent",
  leave: "On leave",
  holiday: "Public holiday",
  off: "Off day",
  pending: "Not clocked in",
  upcoming: "Upcoming",
  untracked: "Before start",
};

/** For correction requests: the instant for a date + "HH:MM". */
export function correctionInstant(date: string, hm: string | null) {
  return hm ? fromMyt(date, hm) : null;
}
