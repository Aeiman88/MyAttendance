import type { Db } from "./db";
import { HttpError } from "./http";
import { STAFF_COLUMNS, buildStaffDays, publicDay, summarize, type StaffRow } from "./report";
import { addDays, currentMonth, isDateStr, isMonthStr, monthRange } from "./time";

export function resolveRange(params: URLSearchParams) {
  const from = params.get("from");
  const to = params.get("to");
  if (isDateStr(from) && isDateStr(to)) {
    if (to < from) throw new HttpError(400, "The end date is before the start date.");
    if (to > addDays(from, 186)) throw new HttpError(400, "Pick a range of 6 months or less.");
    return { from, to };
  }
  const month = params.get("month");
  return monthRange(isMonthStr(month) ? month : currentMonth());
}

/** Record IDs where the same phone/browser clocked for two different people on the same day. */
async function sharedDeviceIds(db: Db, from: string, to: string) {
  const rows = await db.query<{ id: number }>(
    `select a.id from attendance a
      where a.work_date between $1 and $2 and exists (
        select 1 from attendance b
         where b.work_date = a.work_date and b.staff_id <> a.staff_id
           and ((a.in_device is not null and (b.in_device = a.in_device or b.out_device = a.in_device))
             or (a.out_device is not null and (b.in_device = a.out_device or b.out_device = a.out_device))))`,
    [from, to],
  );
  return new Set(rows.map((r) => r.id));
}

export async function adminRecords(db: Db, params: URLSearchParams) {
  const { from, to } = resolveRange(params);
  const staffParam = params.get("staff") ?? "all";
  const allStaff = await db.query<StaffRow>(`select ${STAFF_COLUMNS} from staff order by full_name`);
  let list: StaffRow[];
  const single = staffParam !== "all";
  if (single) {
    const one = allStaff.find((s) => s.id === Number(staffParam));
    if (!one) throw new HttpError(404, "Staff member not found.");
    list = [one];
  } else {
    const withRecords = new Set(
      (
        await db.query<{ staff_id: number }>(
          "select distinct staff_id from attendance where work_date between $1 and $2",
          [from, to],
        )
      ).map((r) => r.staff_id),
    );
    list = allStaff.filter((s) => s.active || withRecords.has(s.id));
  }

  const [days, shared] = await Promise.all([buildStaffDays(db, list, from, to), sharedDeviceIds(db, from, to)]);
  const rows: Array<{
    staff: { id: number; name: string; staffNo: string };
    day: ReturnType<typeof publicDay>;
    sharedDevice: boolean;
  }> = [];
  for (const s of list) {
    for (const d of days.get(s.id)!.days) {
      if (!single && !d.record) continue;
      rows.push({
        staff: { id: s.id, name: s.full_name, staffNo: s.staff_no },
        day: publicDay(d),
        sharedDevice: d.record ? shared.has(d.record.id) : false,
      });
    }
  }
  rows.sort((a, b) => (a.day.date === b.day.date ? a.staff.name.localeCompare(b.staff.name) : a.day.date < b.day.date ? 1 : -1));

  return {
    from,
    to,
    staff: single ? list[0].id : "all",
    summary: single ? summarize(days.get(list[0].id)!.days) : null,
    rows,
    staffOptions: allStaff.map((s) => ({ id: s.id, name: s.full_name, staffNo: s.staff_no, active: s.active })),
  };
}
