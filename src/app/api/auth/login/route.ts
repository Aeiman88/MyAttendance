import { z } from "zod";
import { getDb } from "@/lib/db";
import {
  APP_ONLY_MESSAGE,
  checkPassword,
  checkThrottle,
  clearFailures,
  issueAppToken,
  issueSession,
  recordFailure,
  webClockInAllowed,
} from "@/lib/auth";
import { HttpError, body, isHttps, json, route } from "@/lib/http";

const Schema = z.object({
  staffNo: z.string().trim().min(1, "enter your staff number").max(60),
  password: z.string().min(1, "enter your password").max(200),
  /** "app" = the phone app, which gets a token instead of a cookie. */
  client: z.enum(["web", "app"]).optional(),
});

export const POST = route(async (req) => {
  const { staffNo, password, client = "web" } = await body(req, Schema);
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const key = `${staffNo.toLowerCase()}|${ip}`;
  checkThrottle(key);

  const db = await getDb();
  const staff = await db.one<{
    id: number;
    staff_no: string;
    full_name: string;
    password_hash: string;
    active: boolean;
    role: "staff" | "admin";
    must_change_password: boolean;
    token_version: number;
  }>(
    `select id, staff_no, full_name, password_hash, active, role, must_change_password, token_version
       from staff where lower(staff_no) = lower($1)`,
    [staffNo],
  );
  const ok = staff ? await checkPassword(password, staff.password_hash) : false;
  if (!staff || !ok) {
    recordFailure(key);
    throw new HttpError(401, "Wrong staff number or password.");
  }
  if (!staff.active) throw new HttpError(403, "This account is switched off. Ask the DAICOE admin to turn it back on.");

  // The website is for admins. Staff are pointed to the phone app unless the admin allows web clock-in.
  if (client === "web" && staff.role !== "admin" && !(await webClockInAllowed())) {
    throw new HttpError(403, APP_ONLY_MESSAGE, "APP_ONLY", { appPage: "/app" });
  }

  clearFailures(key);
  await db.query("update staff set last_login_at = now() where id = $1", [staff.id]);

  if (client === "app") {
    return json({
      ok: true,
      token: await issueAppToken(staff),
      mustChangePassword: staff.must_change_password,
      user: { id: staff.id, staffNo: staff.staff_no, name: staff.full_name, role: staff.role },
    });
  }
  await issueSession(staff, isHttps(req));
  return json({ ok: true, role: staff.role, mustChangePassword: staff.must_change_password });
});
