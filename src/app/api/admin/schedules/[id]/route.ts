import { z } from "zod";
import { audit, getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { HttpError, body, json, route } from "@/lib/http";
import { defaultScheduleId } from "@/lib/report";
import { hm12 } from "@/lib/time";
import { idParam, scheduleFields } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const admin = await requireAdmin();
  const id = idParam((await params).id);
  const d = await body(req, z.object(scheduleFields));
  if (d.end_time <= d.start_time) throw new HttpError(400, "End time must be after start time.");
  const db = await getDb();
  const taken = await db.one("select id from schedules where lower(code) = lower($1) and id <> $2", [d.code, id]);
  if (taken) throw new HttpError(409, `Code ${d.code} is already used.`);
  const row = await db.one(
    `update schedules set code = $2, name = $3, start_time = $4, end_time = $5, grace_minutes = $6, work_days = $7
      where id = $1 returning id`,
    [id, d.code.toUpperCase(), `${hm12(d.start_time)} – ${hm12(d.end_time)}`, d.start_time, d.end_time, d.grace_minutes, [...new Set(d.work_days)].sort()],
  );
  if (!row) throw new HttpError(404, "Working-hour slot not found.");
  await audit(db, admin.id, "schedule.updated", `schedule:${id}`, d);
  return json({ ok: true });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const admin = await requireAdmin();
  const id = idParam((await params).id);
  const db = await getDb();
  if ((await defaultScheduleId(db)) === id) {
    throw new HttpError(400, "This is the default slot for new staff. Choose another default first.");
  }
  const used = await db.one<{ n: number }>("select count(*)::int as n from staff where schedule_id = $1 and active", [id]);
  if (used?.n) throw new HttpError(400, `${used.n} staff member${used.n > 1 ? "s are" : " is"} on this slot. Move them first.`);
  const row = await db.one("delete from schedules where id = $1 returning code", [id]);
  if (!row) throw new HttpError(404, "Working-hour slot not found.");
  await audit(db, admin.id, "schedule.deleted", `schedule:${id}`, row);
  return json({ ok: true });
});
