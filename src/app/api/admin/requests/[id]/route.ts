import { z } from "zod";
import { audit, getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { HttpError, body, json, route } from "@/lib/http";
import { fromMyt } from "@/lib/time";
import { idParam } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

const Schema = z.object({
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(300).optional(),
});

/** Approve or reject. Approving a time correction writes the corrected times into the record. */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const admin = await requireAdmin();
  const id = idParam((await params).id);
  const { decision, note } = await body(req, Schema);
  const db = await getDb();

  await db.tx(async (t) => {
    const r = await t.one(`select * from requests where id = $1 ${t.kind === "postgres" ? "for update" : ""}`, [id]);
    if (!r) throw new HttpError(404, "Request not found.");
    if (r.status !== "pending") throw new HttpError(409, `This request is already ${r.status}.`);

    if (decision === "approved" && r.type === "pembetulan") {
      const date: string = r.date_from;
      const existing = await t.one("select id, clock_in, clock_out from attendance where staff_id = $1 and work_date = $2", [
        r.staff_id,
        date,
      ]);
      const cin = r.time_in ? fromMyt(date, r.time_in) : existing?.clock_in ?? null;
      const cout = r.time_out ? fromMyt(date, r.time_out) : existing?.clock_out ?? null;
      if (cin && cout && new Date(cout) <= new Date(cin)) {
        throw new HttpError(400, "With this correction the clock-out would be before the clock-in. Reject it or edit the record.");
      }
      if (existing) {
        await t.query(
          "update attendance set clock_in = $2, clock_out = $3, source = 'request', updated_by = $4, updated_at = now() where id = $1",
          [existing.id, cin, cout, admin.id],
        );
      } else {
        await t.query(
          `insert into attendance (staff_id, work_date, clock_in, clock_out, source, updated_by, updated_at)
           values ($1, $2, $3, $4, 'request', $5, now())`,
          [r.staff_id, date, cin, cout, admin.id],
        );
      }
    }
    await t.query(
      "update requests set status = $2, reviewed_by = $3, reviewed_at = now(), review_note = $4 where id = $1",
      [id, decision, admin.id, note || null],
    );
  });

  await audit(db, admin.id, `request.${decision}`, `request:${id}`, { note });
  return json({ ok: true });
});
