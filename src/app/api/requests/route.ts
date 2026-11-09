import { z } from "zod";
import { audit, getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { HttpError, body, json, route } from "@/lib/http";
import { REQUEST_TYPE_KEYS } from "@/lib/rules";
import { addDays, mytDate } from "@/lib/time";
import { dateStr, hm } from "@/lib/validate";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await requireUser();
  const db = await getDb();
  const rows = await db.query(
    `select r.id, r.type, r.date_from, r.date_to, r.time_in, r.time_out, r.reason, r.status, r.review_note,
            r.reviewed_at, r.created_at, s.full_name as reviewer
       from requests r left join staff s on s.id = r.reviewed_by
      where r.staff_id = $1 and r.status <> 'cancelled' -- withdrawn requests disappear from the person's list
      order by r.created_at desc limit 60`,
    [user.id],
  );
  return json({ requests: rows });
});

const Schema = z.object({
  type: z.enum(REQUEST_TYPE_KEYS as [string, ...string[]]),
  dateFrom: dateStr,
  dateTo: dateStr.optional(),
  timeIn: hm.nullable().optional(),
  timeOut: hm.nullable().optional(),
  reason: z.string().trim().min(3, "add a short reason").max(500),
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const data = await body(req, Schema);
  const today = mytDate();
  let dateTo = data.dateTo ?? data.dateFrom;
  let timeIn: string | null = null;
  let timeOut: string | null = null;

  if (data.type === "pembetulan") {
    dateTo = data.dateFrom;
    timeIn = data.timeIn ?? null;
    timeOut = data.timeOut ?? null;
    if (!timeIn && !timeOut) throw new HttpError(400, "Enter the correct clock-in time, clock-out time, or both.");
    if (timeIn && timeOut && timeOut <= timeIn) throw new HttpError(400, "Clock-out time must be after clock-in time.");
    if (data.dateFrom > today) throw new HttpError(400, "A time correction can only be for today or an earlier day.");
  } else {
    if (dateTo < data.dateFrom) throw new HttpError(400, "End date is before the start date.");
    if (dateTo > addDays(data.dateFrom, 62)) throw new HttpError(400, "One request can cover at most 2 months.");
  }

  const db = await getDb();
  // A double tap or a second try shouldn't send the admin the same request twice.
  const waiting = await db.one<{ id: number }>(
    `select id from requests
      where staff_id = $1 and type = $2 and status = 'pending' and date_from <= $4::date and date_to >= $3::date
      limit 1`,
    [user.id, data.type, data.dateFrom, dateTo],
  );
  if (waiting) {
    throw new HttpError(409, "You already have a request like this waiting for the admin. Withdraw it first if you need to change it.", "DUPLICATE");
  }
  const row = await db.one<{ id: number }>(
    `insert into requests (staff_id, type, date_from, date_to, time_in, time_out, reason)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [user.id, data.type, data.dateFrom, dateTo, timeIn, timeOut, data.reason],
  );
  await audit(db, user.id, "request.created", `request:${row?.id}`, { type: data.type, from: data.dateFrom, to: dateTo });
  return json({ ok: true, id: row?.id }, 201);
});
