"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, RotateCw, Users } from "lucide-react";
import { PageHead, Panel } from "@/components/admin-shell";
import { DayDetailSheet, DayFlags } from "@/components/day-detail";
import { MapView, type MapZone } from "@/components/map-view";
import { Avatar, Button, EmptyState, Spinner, StatusChip, cx } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { STATUS_LABEL, type DayView } from "@/lib/rules";
import { ENGLISH_DAYS, fmt12, isoDow, longDate } from "@/lib/time";

type Overview = {
  today: string;
  counts: { total: number; in: number; out: number; notIn: number; late: number; external: number; away: number };
  staff: Array<{ id: number; name: string; staffNo: string; position: string; schedule: { code: string } | null; day: DayView }>;
  zones: MapZone[];
  pendingRequests: number;
};

export default function AdminToday() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<DayView | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api<Overview>("/api/admin/overview"));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 60_000);
    return () => window.clearInterval(t);
  }, [load]);

  const markers = useMemo(
    () =>
      (data?.staff ?? [])
        .filter((s) => s.day.record?.in_lat != null)
        .map((s) => ({
          id: s.id,
          lat: s.day.record!.in_lat!,
          lng: s.day.record!.in_lng!,
          color: s.day.record!.in_zone === "external" ? "#c48a0c" : "#0c8e8a",
          label: initials(s.name),
          title: `${s.name}, in ${s.day.clockIn ? fmt12(new Date(s.day.clockIn)) : ""}`,
        })),
    [data],
  );

  if (!data) {
    return (
      <div className="grid place-items-center py-24">
        {error ? <p className="text-danger-600">{error}</p> : <Spinner />}
      </div>
    );
  }

  const c = data.counts;
  const order: Record<string, number> = { working: 0, present: 1, incomplete: 2, pending: 3, leave: 4, holiday: 5, off: 6 };
  const staff = [...data.staff].sort((a, b) => (order[a.day.status] ?? 9) - (order[b.day.status] ?? 9) || a.name.localeCompare(b.name));

  return (
    <div>
      <PageHead
        title="Today"
        sub={`${ENGLISH_DAYS[isoDow(data.today) - 1]}, ${longDate(data.today)}`}
        actions={
          <Button variant="secondary" size="sm" onClick={load} loading={loading}>
            {!loading && <RotateCw className="size-4" />} Refresh
          </Button>
        }
      />

      {data.pendingRequests > 0 && (
        <Link
          href="/admin/requests"
          className="mb-4 flex items-center gap-3 rounded-2xl bg-gold-50 px-4 py-3 text-[14px] font-semibold text-navy-900 ring-1 ring-gold-100 hover:bg-gold-100/60"
        >
          <BellRing className="size-5 text-gold-600" />
          {data.pendingRequests} request{data.pendingRequests > 1 ? "s" : ""} waiting for your approval
        </Link>
      )}

      <dl className="mb-5 grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-navy-100 ring-1 ring-navy-100 sm:grid-cols-6">
        <Count label="In now" value={c.in} accent="text-teal-700" />
        <Count label="Clocked out" value={c.out} />
        <Count label="Not in yet" value={c.notIn} accent={c.notIn ? "text-navy-900" : undefined} />
        <Count label="Late" value={c.late} accent={c.late ? "text-gold-700" : undefined} />
        <Count label="External" value={c.external} accent={c.external ? "text-iris-700" : undefined} />
        <Count label="Away" value={c.away} />
      </dl>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <Panel title={`Staff (${c.total})`}>
          {staff.length === 0 ? (
            <EmptyState icon={<Users className="size-6" />} title="No staff yet">
              <Link href="/admin/staff" className="font-semibold text-iris-600">
                Add the DAICOE team
              </Link>{" "}
              so they can start clocking in.
            </EmptyState>
          ) : (
            <ul>
              {staff.map((s) => (
                <li key={s.id} className="border-b border-navy-50 last:border-0">
                  <button type="button" onClick={() => setOpen(s.day)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-navy-50/60">
                    <Avatar name={s.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-semibold text-navy-900">{s.name}</span>
                      <span className="flex flex-wrap items-center gap-1 text-[12.5px] text-slate-500">
                        {s.day.clockIn ? (
                          <span className="tabular">
                            In {fmt12(new Date(s.day.clockIn))}
                            {s.day.clockOut ? `, out ${fmt12(new Date(s.day.clockOut))}` : ""}
                          </span>
                        ) : (
                          <span>{s.day.holiday ?? s.day.leave?.label ?? s.staffNo}</span>
                        )}
                        <DayFlags day={s.day} />
                      </span>
                    </span>
                    <StatusChip status={s.day.status} label={STATUS_LABEL[s.day.status]} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Where they clocked in" className="overflow-hidden">
          <div className="relative h-[380px]">
            <MapView className="absolute inset-0" zones={data.zones} markers={markers} fit="all" />
          </div>
          <p className="flex gap-4 px-4 py-2.5 text-[12.5px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-teal-600" /> Internal
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-gold-600" /> External
            </span>
          </p>
        </Panel>
      </div>
      <DayDetailSheet day={open} onClose={() => setOpen(null)} canCorrect={false} />
    </div>
  );
}

function initials(name: string) {
  return name
    .replace(/\b(bin|binti|bte|bt)\b/gi, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function Count({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="bg-white px-4 py-3">
      <dt className="text-[12.5px] font-medium text-slate-500">{label}</dt>
      <dd className={cx("text-[24px] font-bold leading-tight tabular", accent ?? "text-slate-400")}>{value}</dd>
    </div>
  );
}
