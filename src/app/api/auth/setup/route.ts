import { z } from "zod";
import { audit, getDb } from "@/lib/db";
import { hashPassword, issueSession } from "@/lib/auth";
import { HttpError, body, isHttps, json, route } from "@/lib/http";
import { defaultScheduleId } from "@/lib/report";
import { fullName, optionalText, password, staffNo } from "@/lib/validate";

const Schema = z.object({ fullName, staffNo, position: optionalText(120), password });

/** Creates the very first account (an admin). Refuses once any account exists. */
export const POST = route(async (req) => {
  const data = await body(req, Schema);
  const db = await getDb();
  const hash = await hashPassword(data.password);
  const staff = await db.tx(async (t) => {
    if (t.kind === "postgres") await t.query("select pg_advisory_xact_lock(7270432)");
    const existing = await t.one<{ n: number }>("select count(*)::int as n from staff");
    if (existing && existing.n > 0) throw new HttpError(409, "Setup is already done. Log in instead.");
    const scheduleId = await defaultScheduleId(t);
    return t.one<{ id: number; token_version: number }>(
      `insert into staff (staff_no, full_name, position, role, schedule_id, password_hash, must_change_password)
       values ($1, $2, $3, 'admin', $4, $5, false) returning id, token_version`,
      [data.staffNo, data.fullName, data.position, scheduleId, hash],
    );
  });
  if (!staff) throw new HttpError(500, "Could not create the account.");
  await audit(db, staff.id, "setup.admin_created", `staff:${staff.id}`);
  await issueSession(staff, isHttps(req));
  return json({ ok: true });
});
