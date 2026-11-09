import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { route } from "@/lib/http";
import { adminRecords } from "@/lib/admin-records";
import { STATUS_LABEL } from "@/lib/rules";
import { dmy, fmtDuration, mytHM } from "@/lib/time";

export const dynamic = "force-dynamic";

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV that opens cleanly in Excel (UTF-8 with BOM). */
export const GET = route(async (req) => {
  await requireAdmin();
  const db = await getDb();
  const data = await adminRecords(db, new URL(req.url).searchParams);
  const header = [
    "Date", "Day", "Staff No", "Name", "Status", "Clock In", "Clock Out", "Worked (h:mm)", "Late (min)",
    "Early leave (min)", "In zone", "In latitude", "In longitude", "In accuracy (m)", "In reason",
    "Out zone", "Out latitude", "Out longitude", "Out accuracy (m)", "Out reason", "Shared device", "Perkara Khas",
  ];
  const lines = [header.map(cell).join(",")];
  for (const { staff, day, sharedDevice } of [...data.rows].reverse()) {
    const r = day.record;
    lines.push(
      [
        dmy(day.date), day.dayMs, staff.staffNo, staff.name, STATUS_LABEL[day.status],
        day.clockIn ? mytHM(new Date(day.clockIn)) : "", day.clockOut ? mytHM(new Date(day.clockOut)) : "",
        day.workedMins != null && day.clockOut ? fmtDuration(day.workedMins) : "",
        day.lateMins || "", day.earlyMins || "",
        r?.in_zone ?? "", r?.in_lat ?? "", r?.in_lng ?? "", r?.in_accuracy ?? "", r?.in_note ?? "",
        r?.out_zone ?? "", r?.out_lat ?? "", r?.out_lng ?? "", r?.out_accuracy ?? "", r?.out_note ?? "",
        sharedDevice ? "yes" : "", day.remarkMs,
      ]
        .map(cell)
        .join(","),
    );
  }
  const name = `attendance_${data.from}_to_${data.to}.csv`;
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
});
