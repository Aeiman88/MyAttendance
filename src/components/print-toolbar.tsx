"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowLeft, Printer } from "lucide-react";

/** Screen-only bar above the sheets. Also scales the A4 sheets down to fit narrow screens. */
export function PrintToolbar({
  backHref,
  heading,
  period,
  pages,
  withSig,
  toggleSigHref,
}: {
  backHref: string;
  heading: string;
  period: string;
  pages: number;
  withSig: boolean;
  toggleSigHref: string;
}) {
  useEffect(() => {
    const fit = () => {
      const sheetPx = (297 / 25.4) * 96; // A4 landscape width in CSS px
      const zoom = Math.min(1, (window.innerWidth - 32) / sheetPx);
      document.documentElement.style.setProperty("--sheet-zoom", String(Math.max(0.2, zoom)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  return (
    <div className="no-print fixed inset-x-0 top-0 z-50 border-b border-navy-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link href={backHref} className="grid size-10 shrink-0 place-items-center rounded-xl text-navy-800 hover:bg-navy-50" aria-label="Back">
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-navy-900">{heading}</p>
          <p className="truncate text-[12.5px] text-slate-500">
            {period}, {pages} page{pages === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href={toggleSigHref}
          className="hidden h-10 items-center rounded-xl px-3 text-[13.5px] font-semibold text-navy-700 ring-1 ring-navy-200 hover:bg-navy-50 sm:inline-flex"
        >
          {withSig ? "Hide signatures" : "Show signatures"}
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-navy-800 px-4 text-[14px] font-semibold text-white hover:bg-navy-700"
        >
          <Printer className="size-4" /> Print
        </button>
      </div>
    </div>
  );
}
