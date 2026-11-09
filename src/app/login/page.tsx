import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth-frame";
import { LoginForm } from "@/components/auth-forms";
import { getUser, webClockInAllowed } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect("/");
  const db = await getDb();
  const row = await db.one<{ n: number }>("select count(*)::int as n from staff");
  if (!row?.n) redirect("/setup");
  const webClockIn = await webClockInAllowed();
  return (
    <AuthFrame
      title={webClockIn ? "Log in" : "Admin log in"}
      intro={
        webClockIn ? (
          "Use the staff number and password the DAICOE admin gave you."
        ) : (
          <>
            This website is for DAICOE admins. Staff clock in with the{" "}
            <Link href="/app" className="font-semibold text-iris-600 hover:underline">
              MyAttendance app
            </Link>{" "}
            on their phone.
          </>
        )
      }
    >
      <LoginForm />
    </AuthFrame>
  );
}
