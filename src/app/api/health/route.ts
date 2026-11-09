import { getDb, getSettings } from "@/lib/db";
import { json, route } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Used by the phone app to check a server address, and by Docker's health check. */
export const GET = route(async () => {
  const db = await getDb();
  const [row, settings] = await Promise.all([
    db.one<{ staff: number }>("select count(*)::int as staff from staff"),
    getSettings(db),
  ]);
  return json({
    ok: true,
    app: "myattendance",
    orgName: settings.org_name ?? "DAICOE",
    database: db.kind,
    setupDone: (row?.staff ?? 0) > 0,
  });
});
