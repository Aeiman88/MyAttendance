import { getDb, getSettings } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { RECORD_COLUMNS, defaultScheduleId, loadSchedules, loadZones, publicDay, resolveSchedule } from "@/lib/report";
import { buildDay, type Leave, type RecordRow } from "@/lib/rules";
import { addDays, mytDate } from "@/lib/time";

export const dynamic = "force-dynamic";

/** Everything the Clock In/Out screen needs, with the server's clock as the source of truth. */
export const GET = route(async () => {
  const user = await requireUser();
  const db = await getDb();
  const now = new Date();
  const today = mytDate(now);

  const [schedules, fallback, zones, settings, holiday, leaves, record, missed, pending, staff] = await Promise.all([
    loadSchedules(db),
    defaultScheduleId(db),
    loadZones(db),
    getSettings(db),
    db.one<{ name: string }>("select name from holidays where date = $1", [today]),
    db.query<Leave>(
      `select id, type, date_from, date_to, reason from requests
        where staff_id = $1 and status = 'approved' and type <> 'pembetulan' and date_from <= $2 and date_to >= $2`,
      [user.id, today],
    ),
    db.one<RecordRow>(`select ${RECORD_COLUMNS} from attendance where staff_id = $1 and work_date = $2`, [
      user.id,
      today,
    ]),
    db.one<{ work_date: string }>(
      `select a.work_date from attendance a
        where a.staff_id = $1 and a.work_date between $2 and $3 and a.clock_in is not null and a.clock_out is null
          and not exists (select 1 from requests r where r.staff_id = a.staff_id and r.type = 'pembetulan'
                          and r.status in ('pending', 'approved') and r.date_from = a.work_date)
        order by a.work_date desc limit 1`,
      [user.id, addDays(today, -7), addDays(today, -1)],
    ),
    db.one<{ n: number }>("select count(*)::int as n from requests where staff_id = $1 and status = 'pending'", [
      user.id,
    ]),
    db.one<{ created_at: Date }>("select created_at from staff where id = $1", [user.id]),
  ]);

  const schedule = resolveSchedule(schedules, user.scheduleId, fallback);
  const day = buildDay({
    date: today,
    today,
    trackingStart: mytDate(new Date(staff?.created_at ?? now)),
    schedule,
    holiday: holiday?.name ?? null,
    leaves,
    record,
  });

  return json({
    serverTime: now.toISOString(),
    today,
    schedule,
    zones: zones.map(({ id, name, lat, lng, radius_m }) => ({ id, name, lat, lng, radius_m })),
    policy: settings.outside_zone_policy === "block" ? "block" : "reason",
    maxAccuracy: Number(settings.max_accuracy_m || 1000),
    day: publicDay(day),
    missedClockOut: missed?.work_date ?? null,
    pendingRequests: pending?.n ?? 0,
  });
});
