import { z } from "zod";
import { getDb, getSettings } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { HttpError, body, json, route } from "@/lib/http";
import { checkZone, fmtDistance } from "@/lib/geo";
import { loadZones } from "@/lib/report";
import { fmt12, mytDate } from "@/lib/time";

const Schema = z.object({
  action: z.enum(["in", "out"]),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(1_000_000),
  note: z.string().trim().max(300).optional(),
  deviceId: z
    .string()
    .trim()
    .max(64)
    .regex(/^[A-Za-z0-9-]+$/)
    .optional(),
  /** Android reports when the position comes from a fake-GPS ("mock location") app. */
  mocked: z.boolean().optional(),
});

/**
 * Clock in or out. The time always comes from the server, and the zone (Internal/External)
 * is worked out here from the GPS position, so neither can be set from the phone.
 */
export const POST = route(async (req) => {
  const user = await requireUser();
  const input = await body(req, Schema);
  const db = await getDb();
  const now = new Date();
  const today = mytDate(now);

  const [settings, zones] = await Promise.all([getSettings(db), loadZones(db)]);
  if (user.via === "web" && settings.web_clock_in !== "1") {
    throw new HttpError(403, "Clock in and out with the MyAttendance app on your phone.", "APP_ONLY");
  }
  if (input.mocked) {
    throw new HttpError(
      422,
      "Your phone is using a fake location (mock location) app. Turn it off in Developer options, then try again.",
      "MOCK_LOCATION",
    );
  }
  const maxAccuracy = Number(settings.max_accuracy_m || 1000);
  if (input.accuracy > maxAccuracy) {
    throw new HttpError(
      422,
      `Your location is only accurate to about ${fmtDistance(input.accuracy)}. Turn on GPS or move near a window, then try again.`,
      "LOW_ACCURACY",
    );
  }

  const zone = checkZone(input.lat, input.lng, zones);
  const note = input.note?.trim() || null;
  if (zone.status === "external") {
    const where = zone.zone ? `${fmtDistance(zone.outsideBy)} outside ${zone.zone.name}` : "outside the DAICOE zone";
    if (settings.outside_zone_policy === "block") {
      throw new HttpError(403, `You're ${where}. Clocking ${input.action} is only allowed inside the zone.`, "OUTSIDE_BLOCKED");
    }
    if (!note) {
      throw new HttpError(422, `You're ${where}. Add a reason to clock ${input.action} as External.`, "REASON_REQUIRED", {
        outsideBy: zone.outsideBy,
        zoneName: zone.zone?.name ?? null,
      });
    }
  }

  const values = [
    user.id,
    today,
    now,
    input.lat,
    input.lng,
    Math.round(input.accuracy),
    zone.status,
    zone.zone?.name ?? null,
    zone.distance,
    zone.status === "external" ? note : null,
    input.deviceId ?? null,
  ];

  const result = await db.tx(async (t) => {
    const existing = await t.one<{ id: number; clock_in: Date | null; clock_out: Date | null }>(
      `select id, clock_in, clock_out from attendance where staff_id = $1 and work_date = $2 ${
        t.kind === "postgres" ? "for update" : ""
      }`,
      [user.id, today],
    );

    if (input.action === "in") {
      if (existing?.clock_in) {
        throw new HttpError(409, `You already clocked in today at ${fmt12(new Date(existing.clock_in))}.`, "ALREADY_IN");
      }
      if (existing) {
        await t.query(
          `update attendance set clock_in = $3, in_lat = $4, in_lng = $5, in_accuracy = $6, in_zone = $7,
                 in_zone_name = $8, in_distance_m = $9, in_note = $10, in_device = $11
            where staff_id = $1 and work_date = $2`,
          values,
        );
      } else {
        const inserted = await t.one(
          `insert into attendance (staff_id, work_date, clock_in, in_lat, in_lng, in_accuracy, in_zone,
                                   in_zone_name, in_distance_m, in_note, in_device)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           on conflict (staff_id, work_date) do nothing returning id`,
          values,
        );
        if (!inserted) throw new HttpError(409, "You already clocked in today.", "ALREADY_IN");
      }
    } else {
      if (!existing?.clock_in) {
        throw new HttpError(409, "Clock in first. If you forgot, send a time correction request.", "NOT_IN");
      }
      if (existing.clock_out) {
        throw new HttpError(409, `You already clocked out today at ${fmt12(new Date(existing.clock_out))}.`, "ALREADY_OUT");
      }
      await t.query(
        `update attendance set clock_out = $3, out_lat = $4, out_lng = $5, out_accuracy = $6, out_zone = $7,
               out_zone_name = $8, out_distance_m = $9, out_note = $10, out_device = $11
          where staff_id = $1 and work_date = $2`,
        values,
      );
    }
    return { at: now.toISOString() };
  });

  return json({ ok: true, action: input.action, at: result.at, zone: zone.status, zoneName: zone.zone?.name ?? null });
});
