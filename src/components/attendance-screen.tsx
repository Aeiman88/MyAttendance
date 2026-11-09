"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Check,
  Clock3,
  ClipboardList,
  History,
  LocateFixed,
  LogIn,
  LogOut,
  MapPin,
  MapPinOff,
  Navigation,
  RotateCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { MapView, type MapZone } from "./map-view";
import { BrandMark, IconLink, TopBar } from "./staff-shell";
import { Button, Field, Sheet, Spinner, Textarea, cx } from "./ui";
import { useToast } from "./toast";
import { ApiError, api, errorMessage } from "@/lib/api";
import { checkZone, fmtDistance } from "@/lib/geo";
import { scheduledLength, workedMinutes, type DayView, type Schedule } from "@/lib/rules";
import { fmt12, fmtDuration, fmtMins, hm12, hmToMinutes, longDate, mytDate, mytMinutes, ENGLISH_DAYS, isoDow } from "@/lib/time";
import { useGeolocation, type Fix } from "@/hooks/use-geolocation";

type Today = {
  serverTime: string;
  today: string;
  schedule: Schedule | null;
  zones: MapZone[];
  policy: "reason" | "block";
  maxAccuracy: number;
  day: DayView;
  missedClockOut: string | null;
  pendingRequests: number;
};

type Mode = "loading" | "locating" | "nolocation" | "blocked" | "ready" | "done";

function deviceId(): string | undefined {
  try {
    let id = localStorage.getItem("ma_device");
    if (!id) {
      id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem("ma_device", id);
    }
    return id;
  } catch {
    return undefined;
  }
}

export function AttendanceScreen() {
  const toast = useToast();
  const geo = useGeolocation();
  const [data, setData] = useState<Today | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const offset = useRef(0);
  const [tick, setTick] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);
  const [reason, setReason] = useState<{ action: "in" | "out"; message: string } | null>(null);
  const [recenter, setRecenter] = useState(0);
  const [celebrate, setCelebrate] = useState(0);

  const load = useCallback(async () => {
    try {
      const t0 = Date.now();
      const res = await api<Today>("/api/attendance/today");
      const t1 = Date.now();
      offset.current = new Date(res.serverTime).getTime() - (t0 + t1) / 2;
      setData(res);
      setLoadError(null);
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    load();
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    const every = window.setInterval(load, 5 * 60_000);
    const clock = window.setInterval(() => setTick(Date.now()), 1000);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(every);
      window.clearInterval(clock);
    };
  }, [load]);

  const serverNow = useMemo(() => new Date(tick + offset.current), [tick]);

  // Reload when the date changes at midnight.
  useEffect(() => {
    if (data && mytDate(serverNow) !== data.today) load();
  }, [data, serverNow, load]);

  const zone = useMemo(
    () => (geo.fix && data ? checkZone(geo.fix.lat, geo.fix.lng, data.zones) : null),
    [geo.fix, data],
  );

  const day = data?.day;
  const clockIn = day?.clockIn ? new Date(day.clockIn) : null;
  const clockOut = day?.clockOut ? new Date(day.clockOut) : null;
  const action: "in" | "out" | null = !clockIn ? "in" : !clockOut ? "out" : null;
  const worked = clockIn ? workedMinutes(clockIn, clockOut, serverNow) : null;

  let mode: Mode = "loading";
  if (data) {
    if (!action) mode = "done";
    else if (["denied", "unavailable", "insecure", "unsupported"].includes(geo.status)) mode = "nolocation";
    else if (!geo.fix) mode = "locating";
    else if (zone?.status === "external" && data.policy === "block") mode = "blocked";
    else mode = "ready";
  }

  const tone: "internal" | "external" | "neutral" | "blocked" =
    mode === "done" ? "internal" : mode === "blocked" ? "blocked" : mode === "ready" ? (zone?.status === "external" ? "external" : "internal") : "neutral";

  const progress = clockIn ? Math.min(1, (worked ?? 0) / scheduledLength(data?.schedule ?? null)) : mode === "ready" ? 1 : 0;

  async function submit(act: "in" | "out", note?: string) {
    setBusy(true);
    try {
      const fix: Fix = await geo.fresh();
      const res = await api<{ at: string; zone: string }>("/api/attendance/clock", {
        body: { action: act, lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, note, deviceId: deviceId() },
      });
      try {
        navigator.vibrate?.(act === "in" ? 40 : [30, 60, 30]);
      } catch {
        /* not supported */
      }
      toast(`${act === "in" ? "Clocked in" : "Clocked out"} at ${fmt12(new Date(res.at))}${res.zone === "external" ? " (External)" : ""}`);
      setReason(null);
      setConfirmOut(false);
      setCelebrate((n) => n + 1);
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.code === "REASON_REQUIRED") {
        setConfirmOut(false);
        setReason({ action: act, message: e.message });
      } else {
        toast(errorMessage(e), "error");
      }
    } finally {
      setBusy(false);
    }
  }

  function press() {
    if (busy || !data || !action) return;
    if (mode === "nolocation") return geo.retry();
    if (mode !== "ready") return;
    if (zone?.status === "external") {
      const where = zone.zone ? `${fmtDistance(zone.outsideBy)} outside ${zone.zone.name}` : "outside the DAICOE zone";
      setReason({ action, message: `You're ${where}. Add a reason to clock ${action} as External.` });
      return;
    }
    if (action === "out") setConfirmOut(true);
    else submit("in");
  }

  const me = geo.fix ? { lat: geo.fix.lat, lng: geo.fix.lng, accuracy: geo.fix.accuracy } : null;
  const schedule = data?.schedule ?? null;
  const earlyLeaveMins =
    action === "out" && schedule && day?.workday && !day.holiday && !day.leave
      ? Math.max(0, hmToMinutes(schedule.end_time) - mytMinutes(serverNow))
      : 0;

  return (
    <div>
      <TopBar
        title="Attendance"
        left={<BrandMark />}
        right={
          <>
            <IconLink href="/requests" label="Requests" badge={data?.pendingRequests}>
              <ClipboardList className="size-[22px]" />
            </IconLink>
            <IconLink href="/history" label="History">
              <History className="size-[22px]" />
            </IconLink>
          </>
        }
      />

      <div className="px-4">
        {/* Location card */}
        <section className="overflow-hidden rounded-[22px] bg-white ring-1 ring-navy-100">
          <LocationBanner status={geo.status} hasFix={!!geo.fix} />
          <div className="grid grid-cols-2 divide-x divide-navy-100 py-2.5 text-center">
            <Coord label="Latitude" value={geo.fix?.lat} />
            <Coord label="Longitude" value={geo.fix?.lng} />
          </div>
          <div className="relative isolate h-[250px] border-t border-navy-100">
            <MapView
              className="absolute inset-0"
              zones={data?.zones ?? []}
              me={me}
              fit="me"
              recenterKey={recenter}
              padBottom={132}
              attribution="topleft"
            />
            {geo.fix && (
              <span className="absolute bottom-3 left-3 z-[500] rounded-full bg-white/90 px-2.5 py-1 text-[11.5px] font-semibold text-navy-800 shadow-sm ring-1 ring-navy-100 tabular">
                ±{fmtDistance(geo.fix.accuracy)}
              </span>
            )}
            <button
              type="button"
              onClick={() => setRecenter((n) => n + 1)}
              aria-label="Centre map on my location"
              className="absolute right-3 top-3 z-[500] grid size-11 place-items-center rounded-2xl bg-navy-800 text-white shadow-lg active:scale-95"
            >
              <LocateFixed className="size-5" />
            </button>
          </div>
        </section>

        {/* Clock button, overlapping the map like the UMS Go layout */}
        <div className="relative z-10 -mt-[100px] flex justify-center">
          <ClockButton
            mode={mode}
            action={action}
            tone={tone}
            progress={progress}
            busy={busy}
            celebrate={celebrate}
            onPress={press}
            sub={
              mode === "nolocation"
                ? "Tap to retry"
                : mode === "locating"
                  ? "Finding you…"
                  : mode === "blocked"
                    ? "Outside zone"
                    : mode === "done"
                      ? "Done for today"
                      : zone?.status === "external"
                        ? "External"
                        : undefined
            }
          />
        </div>

        {loadError && !data && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger-700 ring-1 ring-danger-100">
            <span>{loadError}</span>
            <Button size="sm" variant="secondary" onClick={load}>
              <RotateCw className="size-4" /> Retry
            </Button>
          </div>
        )}

        {/* Today card */}
        <section className="mt-3 rounded-[24px] bg-navy-800 p-4 text-white">
          <div className="flex items-center justify-between gap-2 px-1 pb-3 text-[15px] font-semibold">
            <span className="flex items-center gap-2">
              <CalendarDays className="size-[18px] text-teal-300" aria-hidden />
              {data ? longDate(data.today) : "–"}
            </span>
            <span className="flex items-center gap-2 tabular">
              <Clock3 className="size-[18px] text-teal-300" aria-hidden />
              {data ? fmt12(serverNow, true) : "–"}
            </span>
          </div>

          <div className="grid grid-cols-2 divide-x divide-navy-100 rounded-2xl bg-white py-3 text-center text-navy-900">
            <div className="px-2">
              <p className="text-[12px] font-medium text-navy-600">Working hours</p>
              <p className="text-[19px] font-bold leading-tight">{schedule?.code ?? "–"}</p>
              <p className="text-[11.5px] text-slate-500">
                {schedule ? `${hm12(schedule.start_time)} – ${hm12(schedule.end_time)}` : "No slot set"}
              </p>
            </div>
            <div className="px-2">
              <p className="text-[12px] font-medium text-navy-600">Zone status</p>
              <ZoneStatus geoStatus={geo.status} zone={zone} />
            </div>
          </div>

          <div className="mt-2.5 grid grid-cols-3 divide-x divide-navy-100 rounded-2xl bg-white py-3 text-center text-navy-900">
            <TimeCell label="Clock in" value={clockIn ? fmt12(clockIn) : null} />
            <TimeCell label="Clock out" value={clockOut ? fmt12(clockOut) : null} />
            <TimeCell label="Working hrs" value={fmtDuration(worked ?? 0)} always />
          </div>

          {day && <DayNotes day={day} schedule={schedule} />}
        </section>

        {data?.missedClockOut && (
          <Link
            href={`/requests?new=pembetulan&date=${data.missedClockOut}`}
            className="mt-3 flex items-start gap-3 rounded-2xl bg-gold-50 px-4 py-3.5 ring-1 ring-gold-100"
          >
            <TriangleAlert className="mt-0.5 size-5 shrink-0 text-gold-600" aria-hidden />
            <span className="text-sm leading-snug text-navy-900">
              <span className="font-semibold">No clock-out on {ENGLISH_DAYS[isoDow(data.missedClockOut) - 1]}, {longDate(data.missedClockOut)}.</span>{" "}
              <span className="text-navy-700 underline decoration-gold-400 underline-offset-2">Send a time correction</span> so the record is complete.
            </span>
          </Link>
        )}
      </div>

      {/* Confirm clock out */}
      <Sheet open={confirmOut} onClose={() => setConfirmOut(false)} title="Clock out now?">
        <p className="text-[15px] leading-relaxed text-slate-600">
          You&apos;ve worked <span className="font-semibold text-navy-900 tabular">{fmtDuration(worked ?? 0)}</span> today.
          {earlyLeaveMins > 0 && schedule && (
            <>
              {" "}
              Your working hours end at <span className="font-semibold text-gold-700">{hm12(schedule.end_time)}</span>, so this will show as leaving{" "}
              {earlyLeaveMins} min early.
            </>
          )}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => setConfirmOut(false)}>
            Not yet
          </Button>
          <Button onClick={() => submit("out")} loading={busy} data-autofocus>
            <LogOut className="size-4" /> Clock out
          </Button>
        </div>
      </Sheet>

      {/* Reason for External */}
      <ReasonSheet
        open={!!reason}
        message={reason?.message ?? ""}
        action={reason?.action ?? "in"}
        busy={busy}
        onClose={() => setReason(null)}
        onSubmit={(note) => reason && submit(reason.action, note)}
      />
    </div>
  );
}

function LocationBanner({ status, hasFix }: { status: string; hasFix: boolean }) {
  const active = status === "active" && hasFix;
  const blocked = ["denied", "unavailable", "insecure", "unsupported"].includes(status);
  return (
    <div
      className={cx(
        "flex items-center justify-center gap-2.5 py-2.5 text-[15px] font-semibold text-white",
        blocked ? "bg-danger-600" : "bg-navy-800",
      )}
    >
      {active ? (
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping-soft rounded-full bg-teal-300" />
          <span className="relative inline-flex size-2.5 rounded-full bg-teal-300" />
        </span>
      ) : blocked ? (
        <MapPinOff className="size-[18px]" aria-hidden />
      ) : (
        <Spinner className="size-4 text-white/80" />
      )}
      <MapPin className={cx("size-[18px]", !active && "hidden")} aria-hidden />
      {active ? "Location active" : blocked ? "Location unavailable" : "Finding your location…"}
    </div>
  );
}

function Coord({ label, value }: { label: string; value?: number }) {
  return (
    <div>
      <p className="text-[12.5px] font-medium text-navy-600">{label}</p>
      <p className="text-[17px] font-bold text-navy-900 tabular">{value != null ? value.toFixed(6) : "–"}</p>
    </div>
  );
}

function ZoneStatus({ geoStatus, zone }: { geoStatus: string; zone: ReturnType<typeof checkZone> | null }) {
  if (!zone) {
    return (
      <p className="mt-0.5 text-[17px] font-bold text-slate-400">{geoStatus === "locating" ? "Checking…" : "Unknown"}</p>
    );
  }
  if (zone.status === "internal") {
    return (
      <div>
        <p className="flex items-center justify-center gap-1.5 text-[19px] font-bold leading-tight text-teal-700">
          Internal <ShieldCheck className="size-5" aria-hidden />
        </p>
        <p className="truncate text-[11.5px] text-slate-500">{zone.zone?.name}</p>
      </div>
    );
  }
  return (
    <div>
      <p className="flex items-center justify-center gap-1.5 text-[19px] font-bold leading-tight text-gold-700">
        External <Navigation className="size-4" aria-hidden />
      </p>
      <p className="text-[11.5px] text-slate-500 tabular">{fmtDistance(zone.outsideBy)} from zone</p>
    </div>
  );
}

function TimeCell({ label, value, always }: { label: string; value: string | null; always?: boolean }) {
  return (
    <div className="px-1">
      <p className="text-[12px] font-medium text-navy-600">{label}</p>
      <p className={cx("text-[19px] font-bold leading-tight tabular", value || always ? "text-navy-900" : "text-slate-300")}>
        {value ?? "--:--"}
      </p>
    </div>
  );
}

function DayNotes({ day, schedule }: { day: DayView; schedule: Schedule | null }) {
  const notes: Array<{ text: string; tone: "teal" | "gold" | "white" }> = [];
  if (day.holiday) notes.push({ text: `Public holiday: ${day.holiday}`, tone: "white" });
  if (day.leave) notes.push({ text: `Approved: ${day.leave.label}`, tone: "white" });
  if (!day.workday && !day.holiday) notes.push({ text: "Not a working day on your schedule", tone: "white" });
  if (day.clockIn && day.workday && !day.holiday && !day.leave) {
    notes.push(
      day.lateMins > 0
        ? { text: `Late by ${fmtMins(day.lateMins)}${schedule ? ` (starts ${hm12(schedule.start_time)})` : ""}`, tone: "gold" }
        : { text: "On time", tone: "teal" },
    );
  }
  if (day.earlyMins > 0) notes.push({ text: `Left ${fmtMins(day.earlyMins)} early`, tone: "gold" });
  if (day.record?.in_zone === "external") notes.push({ text: `Clocked in External: ${day.record.in_note ?? ""}`, tone: "gold" });
  if (day.record?.out_zone === "external") notes.push({ text: `Clocked out External: ${day.record.out_note ?? ""}`, tone: "gold" });
  if (!notes.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-1.5 px-0.5">
      {notes.map((n) => (
        <li
          key={n.text}
          className={cx(
            "rounded-full px-2.5 py-1 text-[12px] font-semibold",
            n.tone === "teal" && "bg-teal-500/20 text-teal-300",
            n.tone === "gold" && "bg-gold-500/20 text-gold-300",
            n.tone === "white" && "bg-white/10 text-white/90",
          )}
        >
          {n.text}
        </li>
      ))}
    </ul>
  );
}

const TONE_COLOR = {
  internal: "#12a8a2",
  external: "#e7a928",
  neutral: "#c9d5ec",
  blocked: "#c93838",
};

function ClockButton({
  mode,
  action,
  tone,
  progress,
  busy,
  sub,
  celebrate,
  onPress,
}: {
  mode: Mode;
  action: "in" | "out" | null;
  tone: keyof typeof TONE_COLOR;
  progress: number;
  busy: boolean;
  sub?: string;
  celebrate: number;
  onPress: () => void;
}) {
  const size = 200;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = TONE_COLOR[tone];
  const disabled = busy || mode === "loading" || mode === "locating" || mode === "blocked" || mode === "done";
  const label = mode === "done" ? "Completed" : action === "out" ? "Clock out" : "Clock in";
  const Icon = busy ? null : mode === "done" ? Check : mode === "nolocation" ? MapPinOff : mode === "blocked" ? MapPinOff : action === "out" ? LogOut : LogIn;

  return (
    <div className="relative grid size-[232px] place-items-center">
      {/* soft halo, like the reference */}
      <span className="absolute inset-0 rounded-full bg-white/80 shadow-[0_8px_30px_-12px_rgb(6_18_46/0.35)] ring-1 ring-navy-100 backdrop-blur-sm" aria-hidden />
      {mode === "ready" && action === "in" && !busy && (
        <span
          className="absolute inset-[10px] animate-breathe rounded-full"
          style={{ boxShadow: `0 0 0 7px ${color}38` }}
          aria-hidden
        />
      )}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#d3ddef" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * Math.max(progress, 0.0001)} ${c}`}
          style={{ transition: "stroke-dasharray 600ms ease, stroke 300ms ease" }}
        />
      </svg>
      <button
        key={celebrate}
        type="button"
        onClick={onPress}
        disabled={disabled}
        aria-label={sub ? `${label}. ${sub}` : label}
        className={cx(
          "relative grid size-[164px] place-items-center rounded-full text-white shadow-[inset_0_-10px_24px_rgb(6_18_46/0.35),0_14px_30px_-12px_rgb(6_18_46/0.6)] transition-transform",
          celebrate > 0 && "animate-pop",
          !disabled && "active:scale-[0.97]",
          mode === "done" ? "bg-navy-700" : "bg-navy-800",
          disabled && mode !== "done" && "cursor-not-allowed",
        )}
      >
        <span className="flex flex-col items-center gap-1.5">
          {busy ? <Spinner className="size-10 text-white" /> : Icon && <Icon className="size-10" strokeWidth={2} aria-hidden />}
          <span className="text-[21px] font-bold tracking-tight">{busy ? "Saving…" : label}</span>
          {sub && !busy && (
            <span
              className={cx(
                "-mt-0.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
                tone === "external" ? "bg-gold-500 text-navy-950" : tone === "blocked" ? "bg-danger-600" : "bg-white/15",
              )}
            >
              {sub}
            </span>
          )}
        </span>
      </button>
    </div>
  );
}

function ReasonSheet({
  open,
  message,
  action,
  busy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  message: string;
  action: "in" | "out";
  busy: boolean;
  onClose: () => void;
  onSubmit: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const quick = ["Kursus / bengkel", "Tugas luar", "Lawatan sekolah", "Mesyuarat luar"];
  useEffect(() => {
    if (open) setNote("");
  }, [open]);
  return (
    <Sheet open={open} onClose={onClose} title={`Clock ${action} as External`}>
      <p className="mb-4 text-[14.5px] leading-relaxed text-slate-600">{message}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (note.trim().length >= 3) onSubmit(note.trim());
        }}
      >
        <Field label="Reason" hint="This prints in the Perkara Khas column of your attendance record.">
          {(id) => (
            <Textarea
              id={id}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={300}
              placeholder="e.g. Bengkel AI di SMK Likas"
              required
              minLength={3}
            />
          )}
        </Field>
        <div className="mt-3 flex flex-wrap gap-2">
          {quick.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setNote((n) => (n ? `${n}, ${q}` : q))}
              className="rounded-full bg-navy-50 px-3 py-1.5 text-[13px] font-medium text-navy-700 ring-1 ring-navy-100 hover:bg-navy-100"
            >
              {q}
            </button>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={note.trim().length < 3}>
            {action === "in" ? <LogIn className="size-4" /> : <LogOut className="size-4" />} Clock {action}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
