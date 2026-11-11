import { z } from "zod";
import { audit, getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { HttpError, body, json, route } from "@/lib/http";
import { idParam, zoneFields } from "@/lib/validate";
import { areaShape } from "@/lib/zone-shape";

type Ctx = { params: Promise<{ id: string }> };

const Patch = z.object({
  name: zoneFields.name.optional(),
  lat: zoneFields.lat.optional(),
  lng: zoneFields.lng.optional(),
  radius_m: zoneFields.radius_m.optional(),
  active: zoneFields.active.optional(),
  /** Corners for a drawn area, null to make the zone a circle again, left out to keep it as it is. */
  polygon: zoneFields.polygon.optional(),
});

async function otherActiveZones(id: number) {
  const db = await getDb();
  const row = await db.one<{ n: number }>("select count(*)::int as n from zones where active and id <> $1", [id]);
  return row?.n ?? 0;
}

export const PATCH = route<Ctx>(async (req, { params }) => {
  const admin = await requireAdmin();
  const id = idParam((await params).id);
  const d = await body(req, Patch);
  if (d.active === false && (await otherActiveZones(id)) === 0) {
    throw new HttpError(400, "Keep at least one active zone, or every clock-in will count as External.");
  }
  // A drawn area: its centre and radius come from the outline, not from the request.
  const shape = d.polygon ? areaShape(d.polygon) : null;
  const db = await getDb();
  const row = await db.one(
    `update zones set name = coalesce($2, name), lat = coalesce($3, lat), lng = coalesce($4, lng),
            radius_m = coalesce($5, radius_m), active = coalesce($6, active),
            polygon = case when $7::boolean then $8::jsonb else polygon end
      where id = $1 returning id`,
    [
      id,
      d.name ?? null,
      shape?.lat ?? d.lat ?? null,
      shape?.lng ?? d.lng ?? null,
      shape?.radius_m ?? d.radius_m ?? null,
      d.active ?? null,
      d.polygon !== undefined,
      shape ? JSON.stringify(shape.polygon) : null,
    ],
  );
  if (!row) throw new HttpError(404, "Zone not found.");
  await audit(db, admin.id, "zone.updated", `zone:${id}`, shape ? { ...d, ...shape } : d);
  return json({ ok: true });
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const admin = await requireAdmin();
  const id = idParam((await params).id);
  if ((await otherActiveZones(id)) === 0) {
    throw new HttpError(400, "This is the only active zone. Add another zone before deleting it.");
  }
  const db = await getDb();
  const row = await db.one("delete from zones where id = $1 returning name", [id]);
  if (!row) throw new HttpError(404, "Zone not found.");
  await audit(db, admin.id, "zone.deleted", `zone:${id}`, row);
  return json({ ok: true });
});
