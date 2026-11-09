import { clearSession } from "@/lib/auth";
import { json, route } from "@/lib/http";

export const POST = route(async () => {
  await clearSession();
  return json({ ok: true });
});
