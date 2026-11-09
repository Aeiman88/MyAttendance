import { z } from "zod";
import { audit, getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { HttpError, body, json, route } from "@/lib/http";
import { fromMyt, mytHM } from "@/lib/time";
import { hm, idParam } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

const EditSchema = z.object({
  clockIn: hm.nullable().optional(),
  clockOut: hm.nullable().optional(),
  remark: z.string().trim().max(300).nullable().optional(),
  reason: z.string().trim().min(3, "say why you are changing this record").max(300),
});

/** Corrects a record. Every change is kept in the audit log with the reason. */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const admin = await requireAdmin();
  const id = idParam((await params).id);
  const d = await body(req, EditSchema);
  const db = await getDb();
  const before = await db.one("select id, staff_id, work_date, clock_in, clock_out, remark, source from attendance where id = $1", [id]);
  if (!before) throw new HttpError(404, "Record not found.");

  const curIn = before.clock_in ? mytHM(new Date(before.clock_in)) : null;
  const curOut = before.clock_out ? mytHM(new Date(before.clock_out)) : null;
  const nextIn = d.clockIn === undefined ? curIn : d.clockIn;
  const nextOut = d.clockOut === undefined ? curOut : d.clockOut;
  if (!nextIn && !nextOut) throw new HttpError(400, "A record needs at least a clock-in or a clock-out time. Delete it instead.");
  if (nextIn && nextOut && nextOut <= nextIn) throw new HttpError(400, "Clock-out must be after clock-in.");
  const timesChanged = nextIn !== curIn || nextOut !== curOut;

  await db.query(
    `update attendance set clock_in = $2, clock_out = $3, remark = $4, source = $5, updated_by = $6, updated_at = now()
      where id = $1`,
    [
      id,
      nextIn ? fromMyt(before.work_date, nextIn) : null,
      nextOut ? fromMyt(before.work_date, nextOut) : null,
      d.remark === undefined ? before.remark : d.remark || null,
      timesChanged ? "manual" : before.source,
      admin.id,
    ],
  );
  await audit(db, admin.id, "record.updated", `attendance:${id}`, {
    reason: d.reason,
    before: { clockIn: curIn, clockOut: curOut, remark: before.remark },
    after: { clockIn: nextIn, clockOut: nextOut, remark: d.remark === undefined ? before.remark : d.remark },
  });
  return json({ ok: true });
});

const DeleteSchema = z.object({ reason: z.string().trim().min(3, "say why you are deleting this record").max(300) });

export const DELETE = route<Ctx>(async (req, { params }) => {
  const admin = await requireAdmin();
  const id = idParam((await params).id);
  const { reason } = await body(req, DeleteSchema);
  const db = await getDb();
  const row = await db.one("delete from attendance where id = $1 returning staff_id, work_date, clock_in, clock_out", [id]);
  if (!row) throw new HttpError(404, "Record not found.");
  await audit(db, admin.id, "record.deleted", `attendance:${id}`, { reason, row });
  return json({ ok: true });
});
