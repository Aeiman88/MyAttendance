export type Zone = { id: number; name: string; lat: number; lng: number; radius_m: number };

/** Great-circle distance in metres (haversine). */
export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371008.8;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export type ZoneCheck = {
  status: "internal" | "external";
  zone: Zone | null;
  /** Distance to the nearest zone centre, in metres. */
  distance: number | null;
  /** How far outside the nearest zone edge (0 when inside). */
  outsideBy: number;
};

/** Internal when the position is inside any active zone; otherwise external (nearest zone reported). */
export function checkZone(lat: number, lng: number, zones: Zone[]): ZoneCheck {
  let best: { zone: Zone; distance: number; edge: number } | null = null;
  for (const zone of zones) {
    const distance = distanceM(lat, lng, zone.lat, zone.lng);
    const edge = distance - zone.radius_m;
    if (!best || edge < best.edge) best = { zone, distance, edge };
  }
  if (!best) return { status: "external", zone: null, distance: null, outsideBy: 0 };
  return {
    status: best.edge <= 0 ? "internal" : "external",
    zone: best.zone,
    distance: Math.round(best.distance),
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
