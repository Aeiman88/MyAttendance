import { z } from "zod";
import { audit, getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { body, json, route } from "@/lib/http";
import { zoneFields } from "@/lib/validate";

export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const d = await body(req, z.object({ ...zoneFields, active: zoneFields.active.default(true) }));
  const db = await getDb();
  const row = await db.one<{ id: number }>(
    "insert into zones (name, lat, lng, radius_m, active) values ($1, $2, $3, $4, $5) returning id",
    [d.name, d.lat, d.lng, d.radius_m, d.active],
  );
  await audit(db, admin.id, "zone.created", `zone:${row?.id}`, d);
  return json({ ok: true, id: row?.id }, 201);
});
