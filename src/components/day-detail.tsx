"use client";

import Link from "next/link";
import { ExternalLink, LogIn, LogOut } from "lucide-react";
import { FlagChip, Sheet, StatusChip } from "./ui";
import { STATUS_LABEL, type DayView } from "@/lib/rules";
import { fmt12, fmtDuration, fmtMins, longDate } from "@/lib/time";
import { fmtDistance, mapsLink } from "@/lib/geo";

export function DayFlags({ day }: { day: DayView }) {
  return (
    <>
      {day.flags.map((f) => (
        <FlagChip key={f} flag={f} detail={f === "late" ? fmtMins(day.lateMins) : f === "early" ? fmtMins(day.earlyMins) : undefined} />
      ))}
    </>
  );
}

function Punch({
  kind,
  at,
  zone,
  zoneName,
  distance,
  note,
  lat,
  lng,
  accuracy,
  corrected,
}: {
  corrected?: boolean;
  kind: "in" | "out";
  at: string | null;
  zone: string | null;
  zoneName: string | null;
  distance: number | null;
  note: string | null;
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
}) {
  const Icon = kind === "in" ? LogIn : LogOut;
  return (
    <div className="flex gap-3 rounded-2xl bg-navy-50 p-3.5">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-navy-700 ring-1 ring-navy-100">
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-baseline justify-between gap-2">
          <span className="text-[13px] font-medium text-navy-600">{kind === "in" ? "Clock in" : "Clock out"}</span>
          <span className="text-[17px] font-bold text-navy-900 tabular">{at ? fmt12(new Date(at)) : "--:--"}</span>
        </p>
        {at && zone && (
          <p className="mt-1 text-[13px] leading-snug text-slate-600">
            <span className={zone === "internal" ? "font-semibold text-teal-700" : "font-semibold text-gold-700"}>
              {zone === "internal" ? "Internal" : "External"}
            </span>
            {zoneName ? `, ${fmtDistance(distance)} from ${zoneName} centre` : ""}
            {accuracy != null ? `, GPS ±${fmtDistance(accuracy)}` : ""}
          </p>
        )}
        {at && !zone && <p className="mt-1 text-[13px] text-slate-500">Time entered by request or by the admin, so there is no GPS position.</p>}
        {at && zone && corrected && (
          <p className="mt-1 text-[12.5px] text-slate-500">Time corrected afterwards. The position is from when the app was used.</p>
        )}
        {note && <p className="mt-1 text-[13px] text-navy-800">Reason: {note}</p>}
        {lat != null && lng != null && (
          <a
            href={mapsLink(lat, lng)}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-semibold text-iris-600 hover:underline"
          >
            {lat.toFixed(5)}, {lng.toFixed(5)} <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

export function DayDetailSheet({ day, onClose, canCorrect = true }: { day: DayView | null; onClose: () => void; canCorrect?: boolean }) {
  const r = day?.record;
  return (
    <Sheet open={!!day} onClose={onClose} title={day ? `${day.dayEn}, ${longDate(day.date)}` : ""}>
      {day && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusChip status={day.status} label={STATUS_LABEL[day.status]} />
            <DayFlags day={day} />
            {day.workedMins != null && day.clockOut && (
              <span className="ml-auto text-[13px] font-semibold text-navy-700 tabular">{fmtDuration(day.workedMins)} worked</span>
            )}
          </div>
          {day.holiday && <p className="text-[14px] text-navy-800">Public holiday: {day.holiday}</p>}
          {day.leave && (
            <p className="text-[14px] text-navy-800">
              Approved {day.leave.label}
              {day.leave.reason ? `: ${day.leave.reason}` : ""}
            </p>
          )}
          {r && (
            <>
              <Punch kind="in" at={day.clockIn} zone={r.in_zone} zoneName={r.in_zone_name} distance={r.in_distance_m} note={r.in_note} lat={r.in_lat} lng={r.in_lng} accuracy={r.in_accuracy} corrected={r.source !== "app"} />
              <Punch kind="out" at={day.clockOut} zone={r.out_zone} zoneName={r.out_zone_name} distance={r.out_distance_m} note={r.out_note} lat={r.out_lat} lng={r.out_lng} accuracy={r.out_accuracy} corrected={r.source !== "app"} />
            </>
          )}
          {day.remarkMs && (
            <div className="rounded-2xl border border-dashed border-navy-200 px-3.5 py-3">
              <p className="text-[12px] font-semibold text-navy-600">Prints in Perkara Khas</p>
              <p className="mt-0.5 text-[14px] text-navy-900">{day.remarkMs}</p>
            </div>
          )}
          {canCorrect && (day.status === "incomplete" || day.status === "absent" || day.flags.includes("late")) && (
            <Link
              href={`/requests?new=${day.status === "absent" ? "cuti" : "pembetulan"}&date=${day.date}`}
              className="mt-1 inline-flex h-11 items-center justify-center rounded-xl bg-navy-800 px-4 text-[15px] font-semibold text-white hover:bg-navy-700"
            >
              {day.status === "absent" ? "Send a leave request" : "Send a time correction"}
            </Link>
          )}
        </div>
      )}
    </Sheet>
  );
}
