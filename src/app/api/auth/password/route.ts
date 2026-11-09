import { z } from "zod";
import { audit, getDb } from "@/lib/db";
import { checkPassword, hashPassword, issueAppToken, issueSession, requireUser } from "@/lib/auth";
import { HttpError, body, isHttps, json, route } from "@/lib/http";
import { password } from "@/lib/validate";

const Schema = z.object({ currentPassword: z.string().min(1, "enter your current password"), newPassword: password });

/** Changes the password and signs out other devices. The device making the change stays signed in. */
export const POST = route(async (req) => {
  const user = await requireUser({ allowPasswordChange: true });
  const { currentPassword, newPassword } = await body(req, Schema);
  if (currentPassword === newPassword) throw new HttpError(400, "Choose a password different from the current one.");
  const db = await getDb();
  const row = await db.one("select password_hash from staff where id = $1", [user.id]);
  if (!row || !(await checkPassword(currentPassword, row.password_hash))) {
    throw new HttpError(400, "Current password is not correct.");
  }
  const hash = await hashPassword(newPassword);
  const updated = await db.one<{ id: number; token_version: number }>(
    `update staff set password_hash = $2, must_change_password = false, token_version = token_version + 1
      where id = $1 returning id, token_version`,
    [user.id, hash],
  );
  await audit(db, user.id, "staff.password_changed", `staff:${user.id}`);
  if (!updated) throw new HttpError(404, "Account not found.");
  if (user.via === "app") return json({ ok: true, token: await issueAppToken(updated) });
  await issueSession(updated, isHttps(req));
  return json({ ok: true });
});
