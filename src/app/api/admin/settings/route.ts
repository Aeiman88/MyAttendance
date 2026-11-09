import { z } from "zod";
import { audit, getDb, getSettings } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { HttpError, body, json, route } from "@/lib/http";
import { loadSchedules, loadZones } from "@/lib/report";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdmin();
  const db = await getDb();
  const [settings, zones, schedules, holidays, usage] = await Promise.all([
    getSettings(db),
    loadZones(db, false),
    loadSchedules(db),
    db.query("select date, name from holidays order by date"),
    db.query<{ schedule_id: number; n: number }>(
      "select schedule_id, count(*)::int as n from staff where active and schedule_id is not null group by schedule_id",
    ),
  ]);
  return json({
    settings: {
      outsideZonePolicy: settings.outside_zone_policy === "block" ? "block" : "reason",
      maxAccuracy: Number(settings.max_accuracy_m || 1000),
      printTitle: settings.print_title,
      orgName: settings.org_name,
      defaultScheduleId: settings.default_schedule_id ? Number(settings.default_schedule_id) : null,
      appDownloadUrl: settings.app_download_url ?? "",
      webClockIn: settings.web_clock_in === "1",
    },
    zones,
    schedules: schedules.map((s) => ({ ...s, staffCount: usage.find((u) => u.schedule_id === s.id)?.n ?? 0 })),
    holidays,
    demoAvailable: process.env.NODE_ENV !== "production" || process.env.DEMO_MODE === "1",
  });
});

const Schema = z.object({
  outsideZonePolicy: z.enum(["reason", "block"]).optional(),
  maxAccuracy: z.number().int().min(20).max(100000).optional(),
  printTitle: z.string().trim().min(3).max(200).optional(),
  orgName: z.string().trim().min(2).max(120).optional(),
  defaultScheduleId: z.number().int().positive().optional(),
  appDownloadUrl: z.union([z.literal(""), z.string().trim().url("enter a full link starting with https://").max(500)]).optional(),
  webClockIn: z.boolean().optional(),
});

export const PUT = route(async (req) => {
  const admin = await requireAdmin();
  const d = await body(req, Schema);
  const db = await getDb();
  if (d.defaultScheduleId) {
    const s = await db.one("select id from schedules where id = $1", [d.defaultScheduleId]);
    if (!s) throw new HttpError(404, "That working-hour slot no longer exists.");
  }
  const map: Record<string, string | undefined> = {
    outside_zone_policy: d.outsideZonePolicy,
    max_accuracy_m: d.maxAccuracy?.toString(),
    print_title: d.printTitle,
    org_name: d.orgName,
    default_schedule_id: d.defaultScheduleId?.toString(),
    app_download_url: d.appDownloadUrl,
    web_clock_in: d.webClockIn === undefined ? undefined : d.webClockIn ? "1" : "0",
  };
  for (const [key, value] of Object.entries(map)) {
    if (value === undefined) continue;
    await db.query(
      "insert into settings (key, value) values ($1, $2) on conflict (key) do update set value = excluded.value",
      [key, value],
    );
  }
  await audit(db, admin.id, "settings.updated", "settings", d);
  return json({ ok: true });
});
