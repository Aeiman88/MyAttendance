/**
 * Street-map tiles for the website's maps and the phone app's Clock screen.
 *
 * CARTO's tiles need a free key since 25 September 2026 (request one at https://carto.com/basemaps/apikey).
 * Set NEXT_PUBLIC_CARTO_API_KEY in Vercel; the app gets the same tiles from /api/me, so changing the key
 * never needs a new app build. Without a key the maps still work (zone, position, framing), just without streets.
 * NEXT_PUBLIC_MAP_TILES (+ NEXT_PUBLIC_MAP_ATTRIBUTION) can point at any other tile service instead.
 */
export type MapTiles = { url: string; attribution: string } | null;

const OSM_CARTO =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>';

export function mapTiles(): MapTiles {
  const custom = process.env.NEXT_PUBLIC_MAP_TILES?.trim();
  if (custom) return { url: custom, attribution: process.env.NEXT_PUBLIC_MAP_ATTRIBUTION?.trim() || OSM_CARTO };
  const key = process.env.NEXT_PUBLIC_CARTO_API_KEY?.trim();
  if (!key) return null;
  return {
    url: `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${encodeURIComponent(key)}`,
    attribution: OSM_CARTO,
  };
}
