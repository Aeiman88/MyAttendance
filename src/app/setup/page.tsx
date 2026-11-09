import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth-frame";
import { SetupForm } from "@/components/auth-forms";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set up" };

export default async function SetupPage() {
  const db = await getDb();
  const row = await db.one<{ n: number }>("select count(*)::int as n from staff");
  if (row?.n) redirect("/login");
  return (
    <AuthFrame
      title="Set up MyAttendance"
      intro="Create the first admin account. You can add the rest of the DAICOE team from the Admin page afterwards."
    >
      <SetupForm />
    </AuthFrame>
  );
}
