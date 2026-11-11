import { areaInfo, type LatLng } from "./geo";
import { HttpError } from "./http";

const round7 = (x: number) => Math.round(x * 1e7) / 1e7;

/**
 * Checks a drawn zone outline and works out the centre and radius stored beside it
 * (the centre is used for the label and "distance from centre"; the radius reaches the farthest
 * corner, so app versions that only know circles still cover the whole area).
 */
export function areaShape(points: LatLng[]) {
  const polygon = points.map(([lat, lng]) => [round7(lat), round7(lng)] as LatLng);
  const info = areaInfo(polygon);
  if (info.crosses) {
    throw new HttpError(400, "The outline crosses itself. Move the corners so the edges don't cross.", "AREA_CROSSES");
  }
  if (info.areaM2 < 100) {
    throw new HttpError(400, "The drawn area is too small. Draw around the school grounds.", "AREA_TOO_SMALL");
  }
  if (info.extentM > 5000) {
    throw new HttpError(400, "The drawn area is too big. Keep every corner within 5 km of the middle.", "AREA_TOO_BIG");
  }
  return {
    polygon,
    lat: round7(info.centre[0]),
    lng: round7(info.centre[1]),
    radius_m: Math.min(5000, Math.max(20, Math.ceil(info.extentM))),
  };
}
