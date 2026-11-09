import { z } from "zod";
import { audit, getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { body, json, route } from "@/lib/http";
import { dateStr } from "@/lib/validate";

const Schema = z.object({ date: dateStr, name: z.string().trim().min(2).max(120) });

/** Adds or renames a public holiday (one per date). */
export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const d = await body(req, Schema);
  const db = await getDb();
  await db.query(
    "insert into holidays (date, name) values ($1, $2) on conflict (date) do update set name = excluded.name",
    [d.date, d.name],
  );
  await audit(db, admin.id, "holiday.saved", `holiday:${d.date}`, d);
  return json({ ok: true }, 201);
});
