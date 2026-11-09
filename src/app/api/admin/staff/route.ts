import { z } from "zod";
import { audit, getDb } from "@/lib/db";
import { hashPassword, requireAdmin, tempPassword } from "@/lib/auth";
import { HttpError, body, json, route } from "@/lib/http";
import { STAFF_COLUMNS, defaultScheduleId } from "@/lib/report";
import { mytDate } from "@/lib/time";
import { fullName, optionalText, staffNo } from "@/lib/validate";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdmin();
  const db = await getDb();
  const today = mytDate();
  const rows = await db.query(
    `select ${STAFF_COLUMNS.split(",").map((c) => `s.${c.trim()}`).join(", ")},
            sc.code as schedule_code, sc.name as schedule_name,
            (select max(a.work_date) from attendance a where a.staff_id = s.id and a.clock_in is not null) as last_seen,
            (select count(*)::int from attendance a where a.staff_id = s.id and a.work_date = $1 and a.clock_in is not null) as in_today
       from staff s left join schedules sc on sc.id = s.schedule_id
      order by s.active desc, s.full_name`,
    [today],
  );
  return json({ staff: rows });
});

const StaffFields = z.object({
  fullName,
  staffNo,
  position: optionalText(120),
  email: optionalText(160),
  phone: optionalText(40),
  role: z.enum(["staff", "admin"]).default("staff"),
  scheduleId: z.number().int().positive().nullable().optional(),
});

/** Adds a staff member with a temporary password they must change on first login. */
export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const data = await body(req, StaffFields);
  const db = await getDb();
  const taken = await db.one("select id from staff where lower(staff_no) = lower($1)", [data.staffNo]);
  if (taken) throw new HttpError(409, `Staff number ${data.staffNo} is already used.`);
  const password = tempPassword();
  const scheduleId = data.scheduleId ?? (await defaultScheduleId(db));
  const row = await db.one<{ id: number }>(
    `insert into staff (staff_no, full_name, position, email, phone, role, schedule_id, password_hash, must_change_password)
     values ($1, $2, $3, $4, $5, $6, $7, $8, true) returning id`,
    [data.staffNo, data.fullName, data.position, data.email, data.phone, data.role, scheduleId, await hashPassword(password)],
  );
  await audit(db, admin.id, "staff.created", `staff:${row?.id}`, { staffNo: data.staffNo, role: data.role });
  return json({ ok: true, id: row?.id, tempPassword: password }, 201);
});
