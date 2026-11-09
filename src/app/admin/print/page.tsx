"use client";

import { useEffect, useState } from "react";
import { PageHead } from "@/components/admin-shell";
import { PrintLauncher } from "@/components/print-launcher";
import { Spinner } from "@/components/ui";
import { useUser } from "@/components/user-context";
import { api } from "@/lib/api";

type Opt = { id: number; full_name: string; staff_no: string; active: boolean };

export default function AdminPrint() {
  const user = useUser();
  const [staff, setStaff] = useState<Opt[] | null>(null);
  useEffect(() => {
    api<{ staff: Opt[] }>("/api/admin/staff").then((r) => setStaff(r.staff));
  }, []);
  return (
    <div className="max-w-xl">
      <PageHead title="Print attendance forms" sub="Rekod Kedatangan Pekerja, filled from MyAttendance records." />
      {staff ? (
        <PrintLauncher
          hasSignature={user.hasSignature}
          staffOptions={staff.filter((s) => s.active).map((s) => ({ id: s.id, name: s.full_name, staffNo: s.staff_no }))}
          defaultStaff="all"
        />
      ) : (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      )}
    </div>
  );
}
