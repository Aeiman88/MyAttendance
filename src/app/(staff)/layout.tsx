import { redirect } from "next/navigation";
import { StaffShell } from "@/components/staff-shell";
import { UserProvider } from "@/components/user-context";
import { getUser, webClockInAllowed } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Web versions of the staff screens. Normally switched off: staff use the phone app and the
 * website is for admins. An admin can switch web clock-in on in Settings (e.g. for iPhone users).
 */
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  if (!(await webClockInAllowed())) redirect(user.role === "admin" ? "/admin" : "/app");
  return (
    <UserProvider user={user}>
      <StaffShell>{children}</StaffShell>
    </UserProvider>
  );
}
