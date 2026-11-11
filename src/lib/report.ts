// Loads attendance data and turns it into per-day views (used by history, admin and print).
import type { Db } from "./db";
import type { Zone } from "./geo";
import { buildDay, type DayView, type Leave, type RecordRow, type Schedule } from "./rules";
import { daysBetween, mytDate } from "./time";

export type StaffRow = {
  id: number;
  staff_no: string;
  full_name: string;
  position: string;
  email: string;
  phone: string;
  role: "staff" | "admin";
  schedule_id: number | null;
  active: boolean;
  must_change_password: boolean;
  last_login_at: Date | null;
  created_at: Date;
};

export const STAFF_COLUMNS = `id, staff_no, full_name, position, email, phone, role, schedule_id, active,
  must_change_password, last_login_at, created_at`;

export async function loadSchedules(db: Db): Promise<Schedule[]> {
  return db.query<Schedule>(
    "select id, code, name, start_time, end_time, grace_minutes, work_days from schedules order by start_time, code",
  );
}

export async function defaultScheduleId(db: Db): Promise<number | null> {
  const row = await db.one<{ value: string }>("select value from settings where key = 'default_schedule_id'");
  return row?.value ? Number(row.value) : null;
}

export function resolveSchedule(schedules: Schedule[], scheduleId: number | null, fallbackId: number | null) {
  return (
    schedules.find((s) => s.id === scheduleId) ??
    schedules.find((s) => s.id === fallbackId) ??
    schedules[0] ??
    null
  );
}

export async function loadZones(db: Db, activeOnly = true): Promise<(Zone & { active: boolean })[]> {
  return db.query(
    `select id, name, lat, lng, radius_m, polygon, active from zones ${activeOnly ? "where active" : ""} order by id`,
  );
}

export async function loadHolidays(db: Db, from: string, to: string): Promise<Map<string, string>> {
  const rows = await db.query<{ date: string; name: string }>(
    "select date, name from holidays where date between $1 and $2",
    [from, to],
  );
  return new Map(rows.map((r) => [r.date, r.name]));
}

export async function loadLeaves(db: Db, staffIds: number[], from: string, to: string) {
  const rows = await db.query<Leave & { staff_id: number }>(
    `select id, staff_id, type, date_from, date_to, reason from requests
      where status = 'approved' and staff_id = any($1::int[]) and date_from <= $3 and date_to >= $2
      order by date_from`,
    [staffIds, from, to],
  );
  const map = new Map<number, Leave[]>();
  for (const r of rows) {
    const list = map.get(r.staff_id) ?? [];
    list.push(r);
    map.set(r.staff_id, list);
  }
  return map;
}

export const RECORD_COLUMNS = `id, staff_id, work_date, clock_in, clock_out,
  in_lat, in_lng, in_accuracy, in_zone, in_zone_name, in_distance_m, in_note, in_device,
  out_lat, out_lng, out_accuracy, out_zone, out_zone_name, out_distance_m, out_note, out_device,
  remark, source`;

export async function loadRecords(db: Db, staffIds: number[], from: string, to: string) {
  const rows = await db.query<RecordRow>(
    `select ${RECORD_COLUMNS} from attendance
      where staff_id = any($1::int[]) and work_date between $2 and $3`,
    [staffIds, from, to],
  );
  const map = new Map<number, Map<string, RecordRow>>();
  for (const r of rows) {
    const m = map.get(r.staff_id) ?? new Map<string, RecordRow>();
    m.set(r.work_date, r);
    map.set(r.staff_id, m);
  }
  return map;
}

/** Day-by-day views for several staff over a date range, with one round of queries. */
export async function buildStaffDays(
  db: Db,
  staffList: Pick<StaffRow, "id" | "schedule_id" | "created_at">[],
  from: string,
  to: string,
) {
  const ids = staffList.map((s) => s.id);
  const [schedules, fallbackId, holidays, leaves, records] = await Promise.all([
    loadSchedules(db),
    defaultScheduleId(db),
    loadHolidays(db, from, to),
    loadLeaves(db, ids, from, to),
    loadRecords(db, ids, from, to),
  ]);
  const today = mytDate();
  const dates = daysBetween(from, to);
  const result = new Map<number, { schedule: Schedule | null; days: DayView[] }>();
  for (const s of staffList) {
    const schedule = resolveSchedule(schedules, s.schedule_id, fallbackId);
    const recs = records.get(s.id);
    const lv = leaves.get(s.id) ?? [];
    const trackingStart = mytDate(new Date(s.created_at));
    const days = dates.map((date) =>
      buildDay({
        date,
        today,
        trackingStart,
        schedule,
        holiday: holidays.get(date) ?? null,
        leaves: lv,
        record: recs?.get(date) ?? null,
      }),
    );
    result.set(s.id, { schedule, days });
  }
  return result;
}

export function summarize(days: DayView[]) {
  const s = { present: 0, late: 0, early: 0, external: 0, leave: 0, absent: 0, incomplete: 0, workedMins: 0, workdays: 0 };
  for (const d of days) {
    if (d.workday && !d.holiday && d.status !== "upcoming" && d.status !== "untracked") s.workdays += 1;
    if (d.status === "present" || d.status === "working" || d.status === "incomplete") s.present += 1;
    if (d.flags.includes("late")) s.late += 1;
    if (d.flags.includes("early")) s.early += 1;
    if (d.flags.includes("external")) s.external += 1;
    if (d.status === "leave") s.leave += 1;
    if (d.status === "absent") s.absent += 1;
    if (d.status === "incomplete") s.incomplete += 1;
    if (d.status === "present" && d.workedMins) s.workedMins += d.workedMins;
  }
  return s;
}

/** Records strip the raw device IDs before going to the browser. */
export function publicDay(d: DayView) {
  if (!d.record) return d;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { in_device, out_device, ...record } = d.record;
  return { ...d, record };
}
