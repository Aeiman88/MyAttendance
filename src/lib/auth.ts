import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { getDb } from "./db";
import { HttpError } from "./http";

export const SESSION_COOKIE = "ma_session";
const SESSION_DAYS = 30;

export type SessionUser = {
  id: number;
  staffNo: string;
  name: string;
  position: string;
  role: "staff" | "admin";
  scheduleId: number | null;
  mustChangePassword: boolean;
  hasSignature: boolean;
  /** "app" = phone app (Bearer token), "web" = website (cookie). */
  via: "app" | "web";
};

let cachedKey: Uint8Array | null = null;

/** HMAC key for session tokens. Production deployments must set AUTH_SECRET. */
function secretKey(): Uint8Array {
  if (cachedKey) return cachedKey;
  const configured = process.env.AUTH_SECRET?.trim();
  if (configured && configured.length >= 32) {
    cachedKey = new TextEncoder().encode(configured);
    return cachedKey;
  }
  if (process.env.DATABASE_URL || process.env.VERCEL) {
    throw new Error("AUTH_SECRET is missing or shorter than 32 characters. Set it in your environment variables.");
  }
  // Local/demo mode: keep a random secret next to the PGlite data so sessions survive restarts.
  const file = path.join(process.cwd(), ".data", "dev-secret");
  let secret = "";
  try {
    secret = fs.readFileSync(file, "utf8").trim();
  } catch {
    secret = crypto.randomBytes(32).toString("hex");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, secret);
  }
  cachedKey = new TextEncoder().encode(secret);
  return cachedKey;
}

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}
export async function checkPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

/** Readable temporary password, e.g. "kopi-7342-awan". */
export function tempPassword() {
  const words = ["kopi", "awan", "bunga", "pantai", "gunung", "bintang", "sungai", "rimba", "pelangi", "ombak"];
  const pick = () => words[crypto.randomInt(words.length)];
  return `${pick()}-${crypto.randomInt(1000, 9999)}-${pick()}`;
}

const APP_TOKEN_DAYS = 180;

async function signToken(staff: { id: number; token_version: number }, audience: "web" | "app", days: number) {
  return new SignJWT({ ver: staff.token_version })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(staff.id))
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(secretKey());
}

/** Token for the phone app, sent back as `Authorization: Bearer …` and kept in the phone's secure storage. */
export async function issueAppToken(staff: { id: number; token_version: number }) {
  return signToken(staff, "app", APP_TOKEN_DAYS);
}

export async function issueSession(staff: { id: number; token_version: number }, secure: boolean) {
  const token = await signToken(staff, "web", SESSION_DAYS);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/**
 * The signed-in staff member, or null. The phone app sends a Bearer token; the admin website uses a cookie.
 * Checks the account is still active and the token has not been revoked (password reset, switched off).
 */
export async function getUser(): Promise<SessionUser | null> {
  const authz = (await headers()).get("authorization");
  const bearer = authz?.toLowerCase().startsWith("bearer ") ? authz.slice(7).trim() : null;
  const via: SessionUser["via"] = bearer ? "app" : "web";
  const token = bearer ?? (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  let sub: string | undefined;
  let ver: unknown;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    // Older web sessions were issued before audiences existed; treat them as web sessions.
    const aud = payload.aud ?? "web";
    if (aud !== via) return null;
    sub = payload.sub;
    ver = payload.ver;
  } catch {
    return null;
  }
  const db = await getDb();
  const row = await db.one(
    `select id, staff_no, full_name, position, role, schedule_id, must_change_password, token_version,
            active, signature is not null as has_signature
       from staff where id = $1`,
    [Number(sub)],
  );
  if (!row || !row.active || row.token_version !== ver) return null;
  return {
    id: row.id,
    staffNo: row.staff_no,
    name: row.full_name,
    position: row.position,
    role: row.role,
    scheduleId: row.schedule_id,
    mustChangePassword: row.must_change_password,
    hasSignature: row.has_signature,
    via,
  };
}

/** Whether staff may use the website for their own attendance (normally they use the phone app). */
export async function webClockInAllowed(): Promise<boolean> {
  const db = await getDb();
  const row = await db.one<{ value: string }>("select value from settings where key = 'web_clock_in'");
  return row?.value === "1";
}

export const APP_ONLY_MESSAGE = "Staff use the MyAttendance app on their phone. Ask the admin for the app link.";

export async function requireUser(opts: { allowPasswordChange?: boolean } = {}): Promise<SessionUser> {
  const user = await getUser();
  if (!user) throw new HttpError(401, "Your session has ended. Log in again.", "UNAUTHENTICATED");
  if (user.via === "web" && user.role !== "admin" && !(await webClockInAllowed())) {
    throw new HttpError(403, APP_ONLY_MESSAGE, "APP_ONLY");
  }
  if (user.mustChangePassword && !opts.allowPasswordChange) {
    throw new HttpError(403, "Set a new password before continuing.", "PASSWORD_CHANGE_REQUIRED");
  }
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new HttpError(403, "Only admins can do this.", "FORBIDDEN");
  return user;
}

// ---- login throttling (per server instance) ----
const attempts = new Map<string, { count: number; until: number }>();
const MAX_ATTEMPTS = 5;
const LOCK_MS = 5 * 60 * 1000;

export function checkThrottle(key: string) {
  const a = attempts.get(key);
  if (a && a.until > Date.now()) {
    const mins = Math.ceil((a.until - Date.now()) / 60000);
    throw new HttpError(429, `Too many wrong passwords. Try again in ${mins} minute${mins > 1 ? "s" : ""}.`);
  }
}
export function recordFailure(key: string) {
  const a = attempts.get(key) ?? { count: 0, until: 0 };
  a.count += 1;
  if (a.count >= MAX_ATTEMPTS) {
    a.until = Date.now() + LOCK_MS;
    a.count = 0;
  }
  attempts.set(key, a);
}
export function clearFailures(key: string) {
  attempts.delete(key);
}
