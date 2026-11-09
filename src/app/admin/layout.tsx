import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { UserProvider } from "@/components/user-context";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: { default: "Admin", template: "%s | Admin | MyAttendance" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  if (user.role !== "admin") redirect("/attendance");
  return (
    <UserProvider user={user}>
      <AdminShell>{children}</AdminShell>
    </UserProvider>
  );
}
