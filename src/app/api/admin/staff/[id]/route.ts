import { z } from "zod";
import { audit, getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { HttpError, body, json, route } from "@/lib/http";
import { fullName, idParam, optionalText, staffNo } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

const Schema = z.object({
  fullName: fullName.optional(),
  staffNo: staffNo.optional(),
  position: optionalText(120).optional(),
  email: optionalText(160).optional(),
  phone: optionalText(40).optional(),
  role: z.enum(["staff", "admin"]).optional(),
  scheduleId: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const admin = await requireAdmin();
  const id = idParam((await params).id);
  const data = await body(req, Schema);
  const db = await getDb();

  await db.tx(async (t) => {
    const current = await t.one("select id, role, active from staff where id = $1", [id]);
    if (!current) throw new HttpError(404, "Staff member not found.");

    const losingAdmin =
      current.role === "admin" && current.active && (data.role === "staff" || data.active === false);
    if (losingAdmin) {
      const admins = await t.one<{ n: number }>(
        "select count(*)::int as n from staff where role = 'admin' and active and id <> $1",
        [id],
      );
      if (!admins?.n) throw new HttpError(400, "Keep at least one active admin. Make someone else an admin first.");
    }
    if (data.staffNo) {
      const taken = await t.one("select id from staff where lower(staff_no) = lower($1) and id <> $2", [data.staffNo, id]);
      if (taken) throw new HttpError(409, `Staff number ${data.staffNo} is already used.`);
    }

    const sets: string[] = [];
    const vals: unknown[] = [id];
    const add = (col: string, v: unknown) => {
      vals.push(v);
      sets.push(`${col} = $${vals.length}`);
    };
    if (data.fullName !== undefined) add("full_name", data.fullName);
    if (data.staffNo !== undefined) add("staff_no", data.staffNo);
    if (data.position !== undefined) add("position", data.position);
    if (data.email !== undefined) add("email", data.email);
    if (data.phone !== undefined) add("phone", data.phone);
    if (data.role !== undefined) add("role", data.role);
    if (data.scheduleId !== undefined) add("schedule_id", data.scheduleId);
    if (data.active !== undefined) add("active", data.active);
    // Switching an account off, or changing its role, signs it out everywhere.
    if (data.active === false || (data.role && data.role !== current.role)) sets.push("token_version = token_version + 1");
    if (sets.length) await t.query(`update staff set ${sets.join(", ")} where id = $1`, vals);
  });

  await audit(db, admin.id, "staff.updated", `staff:${id}`, data);
  return json({ ok: true });
});
