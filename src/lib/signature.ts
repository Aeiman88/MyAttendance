import { z } from "zod";

/** Pen strokes from the phone app's signature pad: each stroke is a list of [x, y] points. */
export const StrokesSchema = z.object({
  width: z.number().positive().max(4000),
  height: z.number().positive().max(4000),
  strokes: z
    .array(z.array(z.tuple([z.number().finite(), z.number().finite()])).min(1).max(1500))
    .min(1, "draw your signature first")
    .max(60),
});
export type Strokes = z.infer<typeof StrokesSchema>;

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Builds the signature image on the server from plain coordinates, so no image file from the
 * phone is ever stored. The SVG is cropped to the ink and smoothed with quadratic curves.
 */
export function strokesToSvgDataUrl({ strokes }: Strokes): string {
  const total = strokes.reduce((n, s) => n + s.length, 0);
  if (total > 6000) throw new Error("Signature has too many points.");
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of strokes)
    for (const [x, y] of s) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  const pad = 6;
  const w = Math.max(1, maxX - minX) + pad * 2;
  const h = Math.max(1, maxY - minY) + pad * 2;
  const ox = minX - pad;
  const oy = minY - pad;

  const d = strokes
    .map((s) => {
      const pts = s.map(([x, y]) => [r1(x - ox), r1(y - oy)] as const);
      if (pts.length === 1) return `M${pts[0][0]} ${pts[0][1]}l0.1 0`;
      let path = `M${pts[0][0]} ${pts[0][1]}`;
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = r1((pts[i][0] + pts[i + 1][0]) / 2);
        const my = r1((pts[i][1] + pts[i + 1][1]) / 2);
        path += `Q${pts[i][0]} ${pts[i][1]} ${mx} ${my}`;
      }
      const last = pts[pts.length - 1];
      return `${path}L${last[0]} ${last[1]}`;
    })
    .join("");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r1(w)} ${r1(h)}" width="${r1(w)}" height="${r1(h)}">` +
    `<path d="${d}" fill="none" stroke="#0a1a40" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** Splits a stored data URL into its type and bytes. */
export function decodeDataUrl(dataUrl: string): { type: string; bytes: Buffer } | null {
  const m = /^data:(image\/png|image\/svg\+xml);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  return m ? { type: m[1], bytes: Buffer.from(m[2], "base64") } : null;
}
