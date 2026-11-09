import { getDb, getSettings } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { defaultScheduleId, loadSchedules, resolveSchedule } from "@/lib/report";
import { mapTiles } from "@/lib/map-tiles";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  const user = await requireUser({ allowPasswordChange: true });
  const db = await getDb();
  const [schedules, fallback, settings, staff] = await Promise.all([
    loadSchedules(db),
    defaultScheduleId(db),
    getSettings(db),
    db.one("select email, phone, signature, created_at from staff where id = $1", [user.id]),
  ]);
  return json({
    user: { ...user, email: staff?.email ?? "", phone: staff?.phone ?? "", signature: staff?.signature ?? null },
    schedule: resolveSchedule(schedules, user.scheduleId, fallback),
    orgName: settings.org_name,
    // The phone app draws its map with these, so a new key never needs a new app build.
    mapTiles: mapTiles(),
  });
});
