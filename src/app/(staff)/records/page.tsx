"use client";

import { PrintLauncher } from "@/components/print-launcher";
import { TopBar } from "@/components/staff-shell";
import { useUser } from "@/components/user-context";

export default function RecordsPage() {
  const user = useUser();
  return (
    <div>
      <TopBar title="Print record" />
      <div className="px-4">
        <PrintLauncher hasSignature={user.hasSignature} />
      </div>
    </div>
  );
}
