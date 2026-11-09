import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { HttpError, route } from "@/lib/http";
import { decodeDataUrl } from "@/lib/signature";
import { idParam } from "@/lib/validate";

type Ctx = { params: Promise<{ id: string }> };

/** Serves a saved signature image (yourself, or anyone for admins). Used by the print view. */
export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const id = idParam((await params).id);
  if (user.role !== "admin" && user.id !== id) throw new HttpError(403, "Not allowed.");
  const db = await getDb();
  const row = await db.one<{ signature: string | null }>("select signature from staff where id = $1", [id]);
  const decoded = row?.signature ? decodeDataUrl(row.signature) : null;
  if (!decoded) throw new HttpError(404, "No signature.");
  return new Response(new Uint8Array(decoded.bytes), {
    headers: {
      "Content-Type": decoded.type,
      "Cache-Control": "private, max-age=300",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
