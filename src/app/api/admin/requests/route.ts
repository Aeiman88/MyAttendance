import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { json, route } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  await requireAdmin();
  const status = new URL(req.url).searchParams.get("status") === "all" ? "all" : "pending";
  const db = await getDb();
  const rows = await db.query(
    `select r.id, r.type, r.date_from, r.date_to, r.time_in, r.time_out, r.reason, r.status, r.review_note,
            r.reviewed_at, r.created_at, s.id as staff_id, s.full_name, s.staff_no, rv.full_name as reviewer
       from requests r
       join staff s on s.id = r.staff_id
       left join staff rv on rv.id = r.reviewed_by
      ${status === "pending" ? "where r.status = 'pending'" : ""}
      order by (r.status = 'pending') desc, r.created_at desc
      limit 200`,
  );
  return json({ requests: rows });
});
