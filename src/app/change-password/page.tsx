import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthFrame } from "@/components/auth-frame";
import { ChangePasswordForm } from "@/components/auth-forms";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New password" };

export default async function ChangePasswordPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  return (
    <AuthFrame
      title={user.mustChangePassword ? "Choose your own password" : "Change password"}
      intro={
        user.mustChangePassword
          ? `Hi ${user.name.split(" ")[0]}, you're signed in with a temporary password. Choose your own to continue.`
          : "Your other devices will be signed out."
      }
    >
      <ChangePasswordForm forced={user.mustChangePassword} />
    </AuthFrame>
  );
}
