import { audit, getDb } from "@/lib/db";
import { hashPassword, requireAdmin, tempPassword } from "@/lib/auth";
import { HttpError, json, route } from "@/lib/http";
import { idParam } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

/** Gives the staff member a new temporary password and signs them out everywhere. */
export const POST = route<Ctx>(async (_req, { params }) => {
  const admin = await requireAdmin();
  const id = idParam((await params).id);
  const password = tempPassword();
  const db = await getDb();
  const row = await db.one(
    `update staff set password_hash = $2, must_change_password = true, token_version = token_version + 1
      where id = $1 returning id`,
    [id, await hashPassword(password)],
  );
  if (!row) throw new HttpError(404, "Staff member not found.");
  await audit(db, admin.id, "staff.password_reset", `staff:${id}`);
  return json({ ok: true, tempPassword: password });
});
