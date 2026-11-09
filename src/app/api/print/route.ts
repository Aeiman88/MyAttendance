import { getDb } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { json, route } from "@/lib/http";
import { loadPrintData, periodLabel, renderDocument, renderSheets } from "@/lib/print-form";

export const dynamic = "force-dynamic";

/**
 * The attendance form as one self-contained HTML document (signatures inlined),
 * which the phone app turns into a PDF to print or share.
 */
export const GET = route(async (req) => {
  const user = await requireUser();
  const db = await getDb();
  const data = await loadPrintData(db, user, new URL(req.url).searchParams);
  const { html, pages } = renderSheets(data, (s) => s.signature);
  const who = data.staff.length > 1 ? "Semua" : data.staff[0].staff_no;
  return json({
    html: renderDocument(data, html),
    pages,
    period: periodLabel(data),
    filename: `Rekod-Kedatangan_${who}_${data.from}_${data.to}.pdf`.replace(/[^A-Za-z0-9._-]+/g, "-"),
  });
});
