import { z } from "zod";
import { audit, getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { HttpError, body, json, route } from "@/lib/http";
import { adminRecords } from "@/lib/admin-records";
import { fromMyt, mytDate } from "@/lib/time";
import { dateStr, hm } from "@/lib/validate";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  await requireAdmin();
  const params = new URL(req.url).searchParams;
  const db = await getDb();
  return json(await adminRecords(db, params));
});

const Schema = z.object({
  staffId: z.number().int().positive(),
  date: dateStr,
  clockIn: hm.nullable().optional(),
  clockOut: hm.nullable().optional(),
  remark: z.string().trim().max(300).optional(),
  reason: z.string().trim().min(3, "say why you are adding this record").max(300),
});

/** Adds a record by hand (e.g. the phone was flat). Marked "Direkod oleh admin" on the printout. */
export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const d = await body(req, Schema);
  if (!d.clockIn && !d.clockOut) throw new HttpError(400, "Enter a clock-in time, a clock-out time, or both.");
  if (d.clockIn && d.clockOut && d.clockOut <= d.clockIn) throw new HttpError(400, "Clock-out must be after clock-in.");
  if (d.date > mytDate()) throw new HttpError(400, "Records can't be added for future days.");
  const db = await getDb();
  const staff = await db.one("select id from staff where id = $1", [d.staffId]);
  if (!staff) throw new HttpError(404, "Staff member not found.");
  const row = await db.one<{ id: number }>(
    `insert into attendance (staff_id, work_date, clock_in, clock_out, remark, source, updated_by, updated_at)
     values ($1, $2, $3, $4, $5, 'manual', $6, now())
     on conflict (staff_id, work_date) do nothing returning id`,
    [
      d.staffId,
      d.date,
      d.clockIn ? fromMyt(d.date, d.clockIn) : null,
      d.clockOut ? fromMyt(d.date, d.clockOut) : null,
      d.remark || null,
      admin.id,
    ],
  );
  if (!row) throw new HttpError(409, "There is already a record for that day. Edit it instead.");
  await audit(db, admin.id, "record.created", `attendance:${row.id}`, d);
  return json({ ok: true, id: row.id }, 201);
});
