import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { STAFF_COLUMNS, buildStaffDays, loadZones, publicDay, type StaffRow } from "@/lib/report";
import { mytDate } from "@/lib/time";

export const dynamic = "force-dynamic";

/** Today's board: who is in, out, late, external, on leave, or not in yet. */
export const GET = route(async () => {
  await requireAdmin();
  const db = await getDb();
  const today = mytDate();
  const staff = await db.query<StaffRow>(`select ${STAFF_COLUMNS} from staff where active order by full_name`);
  const [days, zones, pending] = await Promise.all([
    buildStaffDays(db, staff, today, today),
    loadZones(db),
    db.one<{ n: number }>("select count(*)::int as n from requests where status = 'pending'"),
  ]);

  const counts = { total: staff.length, in: 0, out: 0, notIn: 0, late: 0, external: 0, away: 0 };
  const rows = staff.map((s) => {
    const entry = days.get(s.id)!;
    const day = publicDay(entry.days[0]);
    if (day.status === "working") counts.in += 1;
    if (day.status === "present") counts.out += 1;
    if (day.status === "pending") counts.notIn += 1;
    if (day.flags.includes("late")) counts.late += 1;
    if (day.flags.includes("external")) counts.external += 1;
    if (!day.record && (day.status === "leave" || day.status === "holiday" || day.status === "off")) counts.away += 1;
    return {
      id: s.id,
      name: s.full_name,
      staffNo: s.staff_no,
      position: s.position,
      schedule: entry.schedule ? { code: entry.schedule.code, name: entry.schedule.name } : null,
      day,
    };
  });

  return json({ today, serverTime: new Date().toISOString(), counts, staff: rows, zones, pendingRequests: pending?.n ?? 0 });
});
