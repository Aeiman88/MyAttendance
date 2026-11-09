"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { currentMonth, monthLabel, shiftMonth } from "@/lib/time";

export function MonthSwitcher({ month, onChange, allowFuture = false }: { month: string; onChange: (m: string) => void; allowFuture?: boolean }) {
  const atLatest = !allowFuture && month >= currentMonth();
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white p-1.5 ring-1 ring-navy-100">
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, -1))}
        className="grid size-9 place-items-center rounded-xl text-navy-700 hover:bg-navy-50"
        aria-label="Previous month"
      >
        <ChevronLeft className="size-5" />
      </button>
      <span className="text-[15px] font-bold text-navy-900">{monthLabel(month)}</span>
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, 1))}
        disabled={atLatest}
        className="grid size-9 place-items-center rounded-xl text-navy-700 hover:bg-navy-50 disabled:opacity-30"
        aria-label="Next month"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
