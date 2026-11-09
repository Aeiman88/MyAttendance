import { z } from "zod";
import { audit, getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { HttpError, body, json, route } from "@/lib/http";
import { StrokesSchema, strokesToSvgDataUrl } from "@/lib/signature";

const Schema = z.union([
  // From the website's drawing pad (PNG image), or null to remove it.
  z.object({
    signature: z
      .string()
      .max(300_000, "signature image is too large")
      .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, "expected a PNG image")
      .nullable(),
  }),
  // From the phone app: the pen strokes, turned into an image here.
  z.object({ strokes: StrokesSchema }),
]);

/** Saves (or clears) the signature printed in the T. Tangan column. */
export const PUT = route(async (req) => {
  const user = await requireUser();
  const data = await body(req, Schema);
  let signature: string | null;
  if ("strokes" in data) {
    try {
      signature = strokesToSvgDataUrl(data.strokes);
    } catch {
      throw new HttpError(400, "That signature has too many points. Clear it and sign again.");
    }
  } else {
    signature = data.signature;
  }
  const db = await getDb();
  await db.query("update staff set signature = $2 where id = $1", [user.id, signature]);
  await audit(db, user.id, signature ? "staff.signature_saved" : "staff.signature_cleared", `staff:${user.id}`);
  return json({ ok: true, signature });
});
