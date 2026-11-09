import { z } from "zod";
import { audit, getDb, type Db } from "@/lib/db";
import { hashPassword, requireAdmin } from "@/lib/auth";
import { HttpError, body, json, route } from "@/lib/http";
import { defaultScheduleId, loadZones } from "@/lib/report";
import { addDays, daysBetween, fromMyt, isoDow, mytDate } from "@/lib/time";

const Schema = z.object({ action: z.enum(["seed", "remove"]) });

const DEMO = [
  { no: "DEMO-01", name: "Nur Aisyah binti Rahman", position: "Jurulatih AI" },
  { no: "DEMO-02", name: "Jason Lee Wei Ming", position: "Pembangun Sistem" },
  { no: "DEMO-03", name: "Mohd Hafiz bin Yusof", position: "Jurutera Rangkaian" },
  { no: "DEMO-04", name: "Clara Jimmy Gimbang", position: "Pembantu Tadbir" },
];

/** Development helper: adds four demo staff with five weeks of realistic records, or removes them. */
export const POST = route(async (req) => {
  if (process.env.NODE_ENV === "production" && process.env.DEMO_MODE !== "1") {
    throw new HttpError(404, "Not found.");
  }
  const admin = await requireAdmin();
  const { action } = await body(req, Schema);
  const db = await getDb();
  if (action === "remove") {
    const rows = await db.query("delete from staff where staff_no like 'DEMO-%' returning id");
    await audit(db, admin.id, "demo.removed", "demo", { staff: rows.length });
    return json({ ok: true, removed: rows.length });
  }
  const created = await seed(db);
  await audit(db, admin.id, "demo.seeded", "demo", { staff: created });
  return json({ ok: true, created });
});

// Deterministic pseudo-random numbers so the demo looks the same every time.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

async function seed(db: Db) {
  const today = mytDate();
  const start = addDays(today, -38);
  const zones = await loadZones(db);
  const zone = zones[0];
  const scheduleId = await defaultScheduleId(db);
  const hash = await hashPassword("demo12345");
  const holidays = new Set((await db.query<{ date: string }>("select date from holidays")).map((h) => h.date));
  let missedDate = addDays(today, -6);
  while (isoDow(missedDate) > 5 || holidays.has(missedDate)) missedDate = addDays(missedDate, -1);
  let created = 0;

  for (const [i, p] of DEMO.entries()) {
    const exists = await db.one("select id from staff where staff_no = $1", [p.no]);
    if (exists) continue;
    const staff = await db.one<{ id: number }>(
      `insert into staff (staff_no, full_name, position, role, schedule_id, password_hash, must_change_password, created_at)
       values ($1, $2, $3, 'staff', $4, $5, false, $6) returning id`,
      [p.no, p.name, p.position, scheduleId, hash, fromMyt(start, "07:00")],
    );
    if (!staff) continue;
    created += 1;
    const rand = rng(97 + i * 31);
    const leaveStart = addDays(today, -(9 + i * 6));
    const leaveDays = i === 1 ? 2 : 1;
    const leaveType = i === 2 ? "mc" : "cuti";
    if (i !== 3) {
      await db.query(
        `insert into requests (staff_id, type, date_from, date_to, reason, status, reviewed_by, reviewed_at)
         values ($1, $2, $3, $4, $5, 'approved', null, now())`,
        [staff.id, leaveType, leaveStart, addDays(leaveStart, leaveDays - 1), leaveType === "mc" ? "Demam" : "Urusan keluarga"],
      );
    }
    const onLeave = new Set(i !== 3 ? daysBetween(leaveStart, addDays(leaveStart, leaveDays - 1)) : []);

    for (const date of daysBetween(start, today)) {
      const dow = isoDow(date);
      if (dow > 5 || holidays.has(date) || onLeave.has(date)) continue;
      if (date === today && i === 3) continue; // one person not in yet today
      const inMin = 7 * 60 + 42 + Math.floor(rand() * 30) + (rand() < 0.12 ? 18 : 0);
      const outMin = 17 * 60 + Math.floor(rand() * 45) - (rand() < 0.08 ? 50 : 0);
      const external = i === 0 && dow === 3 && rand() < 0.7;
      const jitter = () => (rand() - 0.5) * 0.0012;
      const pos = external
        ? { lat: 5.9813 + jitter() / 3, lng: 116.0957 + jitter() / 3, zone: "external", name: zone?.name ?? null, dist: 3920 }
        : { lat: (zone?.lat ?? 5.9459) + jitter(), lng: (zone?.lng ?? 116.0709) + jitter(), zone: "internal", name: zone?.name ?? null, dist: Math.round(rand() * 60) };
      const note = external ? "Bengkel AI di SMK Likas" : null;
      const hmOf = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      const isToday = date === today;
      const missedOut = i === 1 && date === missedDate;
      await db.query(
        `insert into attendance (staff_id, work_date, clock_in, in_lat, in_lng, in_accuracy, in_zone, in_zone_name, in_distance_m,
                                 in_note, in_device, clock_out, out_lat, out_lng, out_accuracy, out_zone, out_zone_name,
                                 out_distance_m, out_note, out_device)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
         on conflict (staff_id, work_date) do nothing`,
        [
          staff.id, date, fromMyt(date, hmOf(inMin)), pos.lat, pos.lng, 8 + Math.round(rand() * 20), pos.zone, pos.name,
          pos.dist, note, `demo-device-${i}`,
          isToday || missedOut ? null : fromMyt(date, hmOf(outMin)),
          isToday || missedOut ? null : pos.lat + jitter() / 4,
          isToday || missedOut ? null : pos.lng + jitter() / 4,
          isToday || missedOut ? null : 10 + Math.round(rand() * 15),
          isToday || missedOut ? null : pos.zone,
          isToday || missedOut ? null : pos.name,
          isToday || missedOut ? null : pos.dist,
          isToday || missedOut ? null : note,
          isToday || missedOut ? null : `demo-device-${i}`,
        ],
      );
    }
    if (i === 1) {
      await db.query(
        `insert into requests (staff_id, type, date_from, date_to, time_out, reason)
         values ($1, 'pembetulan', $2, $2, '17:20', 'Terlupa clock out, telefon kehabisan bateri')`,
        [staff.id, missedDate],
      );
    }
  }
  return created;
}
