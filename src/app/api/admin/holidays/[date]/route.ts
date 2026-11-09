import { audit, getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { HttpError, json, route } from "@/lib/http";
import { isDateStr } from "@/lib/time";

type Ctx = { params: Promise<{ date: string }> };

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const admin = await requireAdmin();
  const { date } = await params;
  if (!isDateStr(date)) throw new HttpError(400, "Invalid date.");
  const db = await getDb();
  const row = await db.one("delete from holidays where date = $1 returning name", [date]);
  if (!row) throw new HttpError(404, "Holiday not found.");
  await audit(db, admin.id, "holiday.deleted", `holiday:${date}`, row);
  return json({ ok: true });
});
