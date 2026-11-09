import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { HttpError, json, route } from "@/lib/http";
import { buildStaffDays, publicDay, summarize, type StaffRow } from "@/lib/report";
import { currentMonth, isMonthStr, monthRange } from "@/lib/time";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  const user = await requireUser();
  const month = new URL(req.url).searchParams.get("month") ?? currentMonth();
  if (!isMonthStr(month)) throw new HttpError(400, "month must look like 2026-11");
  const { from, to } = monthRange(month);
  const db = await getDb();
  const staff = await db.one<Pick<StaffRow, "id" | "schedule_id" | "created_at">>(
    "select id, schedule_id, created_at from staff where id = $1",
    [user.id],
  );
  if (!staff) throw new HttpError(404, "Account not found.");
  const result = (await buildStaffDays(db, [staff], from, to)).get(staff.id)!;
  return json({
    month,
    schedule: result.schedule,
    summary: summarize(result.days),
    days: result.days.map(publicDay),
  });
});
