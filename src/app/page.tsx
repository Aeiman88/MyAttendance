import { redirect } from "next/navigation";
import { getUser, webClockInAllowed } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getUser();
  if (user) {
    if (user.mustChangePassword) redirect("/change-password");
    if (user.role === "admin") redirect("/admin");
    redirect((await webClockInAllowed()) ? "/attendance" : "/app");
  }
  const db = await getDb();
  const row = await db.one<{ n: number }>("select count(*)::int as n from staff");
  redirect(row?.n ? "/login" : "/setup");
}
