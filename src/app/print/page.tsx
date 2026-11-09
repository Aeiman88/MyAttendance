import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PrintToolbar } from "@/components/print-toolbar";
import { getUser, webClockInAllowed } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { FORM_CSS, loadPrintData, periodLabel, renderSheets } from "@/lib/print-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Print attendance record" };

type Search = Promise<Record<string, string | string[] | undefined>>;

/** Screen-only styling around the A4 sheets (grey desk, shadows, scaling on narrow screens). */
const SCREEN_CSS = `
.print-root { background: #dfe5ee; min-height: 100dvh; padding: 88px 16px 40px; }
.print-root .sheet { zoom: var(--sheet-zoom, 1); margin: 0 auto 18px; box-shadow: 0 2px 4px rgb(6 18 46 / .08), 0 18px 40px -18px rgb(6 18 46 / .35); }
@media print {
  html, body { background: #fff !important; }
  .print-root { padding: 0; background: #fff; }
  .print-root .sheet { zoom: 1; margin: 0; box-shadow: none; }
  .no-print { display: none !important; }
}`;

export default async function PrintPage({ searchParams }: { searchParams: Search }) {
  const user = await getUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/change-password");
  if (user.role !== "admin" && !(await webClockInAllowed())) redirect("/attendance");

  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string") params.set(k, v);

  const db = await getDb();
  let data;
  try {
    data = await loadPrintData(db, user, params);
  } catch (e) {
    return <Problem message={e instanceof HttpError ? e.message : "Invalid period."} />;
  }
  const { html, pages } = renderSheets(data, (s) => `/api/signature/${s.id}`);

  const toggleSig = new URLSearchParams(params);
  if (data.withSig) toggleSig.delete("sig");
  else toggleSig.set("sig", "1");

  return (
    <div className="print-root">
      <style dangerouslySetInnerHTML={{ __html: FORM_CSS + SCREEN_CSS }} />
      <PrintToolbar
        backHref={user.role === "admin" ? "/admin/print" : "/records"}
        heading={data.staff.length > 1 ? `${data.staff.length} staff` : data.staff[0].full_name}
        period={periodLabel(data)}
        pages={pages}
        withSig={data.withSig}
        toggleSigHref={`/print?${toggleSig.toString()}`}
      />
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function Problem({ message }: { message: string }) {
  return (
    <div className="grid min-h-dvh place-items-center p-6 text-center">
      <div>
        <p className="text-lg font-bold text-navy-900">Can&apos;t show this record</p>
        <p className="mt-1 text-slate-600">{message}</p>
        <a href="/admin/print" className="mt-4 inline-block font-semibold text-iris-600">
          Back to print options
        </a>
      </div>
    </div>
  );
}
