"use client";

import { useEffect, useState } from "react";
import { CalendarX2, Printer } from "lucide-react";
import { IconLink, TopBar } from "@/components/staff-shell";
import { MonthSwitcher } from "@/components/month-switcher";
import { DayDetailSheet, DayFlags } from "@/components/day-detail";
import { EmptyState, Spinner, StatusChip, cx } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { STATUS_LABEL, type DayView } from "@/lib/rules";
import { currentMonth, fmt12, fmtDuration, mytDate } from "@/lib/time";

type History = {
  month: string;
  summary: { present: number; late: number; external: number; leave: number; absent: number; workedMins: number; workdays: number };
  days: DayView[];
};

export default function HistoryPage() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState<History | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<DayView | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    api<History>(`/api/attendance/history?month=${month}`)
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e) => alive && setError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, [month]);

  const today = mytDate();
  const days = (data?.days ?? []).filter((d) => d.date <= today && d.status !== "untracked").reverse();

  return (
    <div>
      <TopBar
        title="History"
        right={
          <IconLink href={`/records?month=${month}`} label="Print this month">
            <Printer className="size-[22px]" />
          </IconLink>
        }
      />
      <div className="flex flex-col gap-3 px-4">
        <MonthSwitcher month={month} onChange={setMonth} />

        {data && (
          <dl className="grid grid-cols-4 rounded-2xl bg-navy-800 px-2 py-3.5 text-center text-white">
            <Stat label="Present" value={`${data.summary.present}`} sub={`of ${data.summary.workdays}`} />
            <Stat label="Late" value={`${data.summary.late}`} tone={data.summary.late ? "gold" : undefined} />
            <Stat label="External" value={`${data.summary.external}`} />
            <Stat label="Hours" value={fmtDuration(data.summary.workedMins)} />
          </dl>
        )}

        {error && <p className="rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</p>}
        {!data && !error && (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        )}
        {data && days.length === 0 && (
          <EmptyState icon={<CalendarX2 className="size-6" />} title="Nothing recorded this month">
            Your clock-ins will show here day by day.
          </EmptyState>
        )}

        {data && days.length > 0 && (
          <ul className="overflow-hidden rounded-2xl bg-white ring-1 ring-navy-100">
            {days.map((d) => (
              <li key={d.date} className="border-b border-navy-50 last:border-0">
                <button type="button" onClick={() => setOpen(d)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left hover:bg-navy-50/60">
                  <span
                    className={cx(
                      "grid w-11 shrink-0 place-items-center rounded-xl py-1.5",
                      d.workday && !d.holiday ? "bg-navy-50 text-navy-900" : "bg-slate-50 text-slate-400",
                    )}
                  >
                    <span className="text-[17px] font-bold leading-none tabular">{Number(d.date.slice(8))}</span>
                    <span className="mt-0.5 text-[10.5px] font-semibold">{d.dayEn.slice(0, 3)}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    {d.clockIn || d.clockOut ? (
                      <span className="block text-[15px] font-semibold text-navy-900 tabular">
                        {d.clockIn ? fmt12(new Date(d.clockIn)) : "--:--"}
                        <span className="px-1.5 text-slate-300">to</span>
                        {d.clockOut ? fmt12(new Date(d.clockOut)) : "--:--"}
                      </span>
                    ) : (
                      <span className="block text-[14px] font-medium text-slate-500">
                        {d.holiday ?? d.leave?.label ?? (d.workday ? "No record" : "Weekend")}
                      </span>
                    )}
                    <span className="mt-1 flex flex-wrap gap-1">
                      <DayFlags day={d} />
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <StatusChip status={d.status} label={STATUS_LABEL[d.status]} />
                    {d.clockOut && d.workedMins != null && (
                      <span className="text-[12px] font-semibold text-slate-500 tabular">{fmtDuration(d.workedMins)}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <DayDetailSheet day={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "gold" }) {
  return (
    <div className="border-r border-white/10 px-1 last:border-0">
      <dt className="text-[11.5px] font-medium text-navy-200">{label}</dt>
      <dd className={cx("mt-0.5 text-[20px] font-bold leading-tight tabular", tone === "gold" ? "text-gold-300" : "text-white")}>
        {value}
        {sub && <span className="ml-1 text-[12px] font-semibold text-navy-200">{sub}</span>}
      </dd>
    </div>
  );
}
