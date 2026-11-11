// Copied from ../src/lib/geo.ts by scripts/sync-shared.mjs. Edit the original, then run npm run sync-shared.
/** A corner of a drawn zone: [latitude, longitude]. */
export type LatLng = [number, number];

/**
 * An attendance zone: a circle (centre + radius), or the area inside a drawn outline (`polygon`).
 * For a drawn area, lat/lng is the outline's centre and radius_m reaches its farthest corner,
 * so app versions that only know circles still see roughly the right place.
 */
export type Zone = { id: number; name: string; lat: number; lng: number; radius_m: number; polygon?: LatLng[] | null };

const R = 6371008.8;
const toRad = (x: number) => (x * Math.PI) / 180;

/** Great-circle distance in metres (haversine). */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** True when the zone is a drawn area rather than a circle. */
export function isArea(zone: { polygon?: LatLng[] | null }): zone is { polygon: LatLng[] } {
  return Array.isArray(zone.polygon) && zone.polygon.length >= 3;
}

/** Metres east and north of (lat0, lng0). Accurate to well under a metre across a school-sized area. */
function toXY(lat: number, lng: number, lat0: number, lng0: number): [number, number] {
  return [R * toRad(lng - lng0) * Math.cos(toRad(lat0)), R * toRad(lat - lat0)];
}

function fromXY(x: number, y: number, lat0: number, lng0: number): LatLng {
  return [lat0 + ((y / R) * 180) / Math.PI, lng0 + ((x / (R * Math.cos(toRad(lat0)))) * 180) / Math.PI];
}

/** Distance from the origin to the segment a–b. */
function segmentDistance(ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** Signed distance to the zone's edge in metres: negative inside the zone, positive outside. */
export function edgeDistance(lat: number, lng: number, zone: Zone): number {
  if (!isArea(zone)) return distanceM(lat, lng, zone.lat, zone.lng) - zone.radius_m;
  const pts = zone.polygon.map(([a, b]) => toXY(a, b, lat, lng));
  let inside = false;
  let nearest = Infinity;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    // Ray casting from the position (the origin) towards +x.
    if (yi > 0 !== yj > 0 && 0 < ((xj - xi) * -yi) / (yj - yi) + xi) inside = !inside;
    nearest = Math.min(nearest, segmentDistance(xi, yi, xj, yj));
  }
  return inside ? -nearest : nearest;
}

export type AreaInfo = {
  /** Where the label and "distance from centre" are measured from. */
  centre: LatLng;
  areaM2: number;
  /** Distance from the centre to the farthest corner. */
  extentM: number;
  /** True when two edges of the outline cross each other. */
  crosses: boolean;
};

/** Centre, size and validity of a drawn outline (3 or more corners). */
export function areaInfo(points: LatLng[]): AreaInfo {
  const [lat0, lng0] = points[0];
  const xy = points.map(([a, b]) => toXY(a, b, lat0, lng0));
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = xy.length - 1; i < xy.length; j = i++) {
    const cross = xy[j][0] * xy[i][1] - xy[i][0] * xy[j][1];
    twiceArea += cross;
    cx += (xy[j][0] + xy[i][0]) * cross;
    cy += (xy[j][1] + xy[i][1]) * cross;
  }
  const centreXY: [number, number] =
    Math.abs(twiceArea) > 1e-6
      ? [cx / (3 * twiceArea), cy / (3 * twiceArea)]
      : [xy.reduce((s, p) => s + p[0], 0) / xy.length, xy.reduce((s, p) => s + p[1], 0) / xy.length];
  return {
    centre: fromXY(centreXY[0], centreXY[1], lat0, lng0),
    areaM2: Math.abs(twiceArea) / 2,
    extentM: Math.max(...xy.map(([x, y]) => Math.hypot(x - centreXY[0], y - centreXY[1]))),
    crosses: edgesCross(xy),
  };
}

function edgesCross(p: [number, number][]) {
  const n = p.length;
  const side = (a: number[], b: number[], c: number[]) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  for (let i = 0; i < n; i++) {
    const a = p[i];
    const b = p[(i + 1) % n];
    for (let k = i + 2; k < n; k++) {
      if ((k + 1) % n === i) continue; // the two edges share a corner
      const c = p[k];
      const d = p[(k + 1) % n];
      if (side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0) return true;
    }
  }
  return false;
}

/** "850 m²" or "2.4 ha". */
export function fmtArea(m2: number) {
  if (m2 >= 10_000) return `${(m2 / 10_000).toFixed(m2 >= 100_000 ? 0 : 1)} ha`;
  return `${String(Math.round(m2)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")} m²`;
}

export type ZoneCheck = {
  status: "internal" | "external";
  zone: Zone | null;
  /** Distance to the nearest zone's centre, in metres. */
  distance: number | null;
  /** How far outside the nearest zone edge (0 when inside). */
  outsideBy: number;
};

/** Internal when the position is inside any active zone; otherwise external (nearest zone reported). */
export function checkZone(lat: number, lng: number, zones: Zone[]): ZoneCheck {
  let best: { zone: Zone; edge: number } | null = null;
  for (const zone of zones) {
    const edge = edgeDistance(lat, lng, zone);
    if (!best || edge < best.edge) best = { zone, edge };
  }
  if (!best) return { status: "external", zone: null, distance: null, outsideBy: 0 };
  return {
    status: best.edge <= 0 ? "internal" : "external",
    zone: best.zone,
    distance: Math.round(distanceM(lat, lng, best.zone.lat, best.zone.lng)),
    outsideBy: Math.max(0, Math.round(best.edge)),
  };
}

export function mapsLink(lat: number, lng: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function fmtDistance(m: number | null | undefined) {
  if (m == null) return "–";
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}
