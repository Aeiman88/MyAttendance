import { z } from "zod";
import { audit, getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { HttpError, body, json, route } from "@/lib/http";
import { hm12 } from "@/lib/time";
import { scheduleFields } from "@/lib/validate";

export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const d = await body(req, z.object(scheduleFields));
  if (d.end_time <= d.start_time) throw new HttpError(400, "End time must be after start time.");
  const db = await getDb();
  const taken = await db.one("select id from schedules where lower(code) = lower($1)", [d.code]);
  if (taken) throw new HttpError(409, `Code ${d.code} is already used.`);
  const row = await db.one<{ id: number }>(
    `insert into schedules (code, name, start_time, end_time, grace_minutes, work_days)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [d.code.toUpperCase(), `${hm12(d.start_time)} – ${hm12(d.end_time)}`, d.start_time, d.end_time, d.grace_minutes, [...new Set(d.work_days)].sort()],
  );
  await audit(db, admin.id, "schedule.created", `schedule:${row?.id}`, d);
  return json({ ok: true, id: row?.id }, 201);
});
