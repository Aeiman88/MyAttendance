import { audit, getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { HttpError, json, route } from "@/lib/http";
import { idParam } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

/** Staff can withdraw their own request while it is still pending. */
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const id = idParam((await params).id);
  const db = await getDb();
  const row = await db.one(
    "update requests set status = 'cancelled' where id = $1 and staff_id = $2 and status = 'pending' returning id",
    [id, user.id],
  );
  if (!row) throw new HttpError(404, "Only your own pending requests can be withdrawn.");
  await audit(db, user.id, "request.cancelled", `request:${id}`);
  return json({ ok: true });
});
