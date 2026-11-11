import { z } from "zod";
import { audit, getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { body, json, route } from "@/lib/http";
import { zoneFields } from "@/lib/validate";
import { areaShape } from "@/lib/zone-shape";

export const POST = route(async (req) => {
  const admin = await requireAdmin();
  const d = await body(
    req,
    z.object({ ...zoneFields, active: zoneFields.active.default(true), polygon: zoneFields.polygon.optional() }),
  );
  // A drawn area: its centre and radius come from the outline, not from the request.
  const shape = d.polygon ? areaShape(d.polygon) : { lat: d.lat, lng: d.lng, radius_m: d.radius_m, polygon: null };
  const db = await getDb();
  const row = await db.one<{ id: number }>(
    "insert into zones (name, lat, lng, radius_m, polygon, active) values ($1, $2, $3, $4, $5::jsonb, $6) returning id",
    [d.name, shape.lat, shape.lng, shape.radius_m, shape.polygon ? JSON.stringify(shape.polygon) : null, d.active],
  );
  await audit(db, admin.id, "zone.created", `zone:${row?.id}`, { ...d, ...shape });
  return json({ ok: true, id: row?.id }, 201);
});
