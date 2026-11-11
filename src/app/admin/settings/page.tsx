"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Crosshair, Eraser, MapPinned, Pencil, Pentagon, Plus, Smartphone, Trash2, Undo2 } from "lucide-react";
import { PageHead, Panel } from "@/components/admin-shell";
import { MapView, type MapZone } from "@/components/map-view";
import { Button, Field, Input, Segmented, Select, Sheet, Spinner, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { api, errorMessage } from "@/lib/api";
import { areaInfo, fmtArea, isArea, type LatLng } from "@/lib/geo";
import type { Schedule } from "@/lib/rules";
import { ENGLISH_DAYS, dmy, hm12, isoDow } from "@/lib/time";

type Zone = { id: number; name: string; lat: number; lng: number; radius_m: number; polygon: LatLng[] | null; active: boolean };
type Settings = {
  settings: {
    outsideZonePolicy: "reason" | "block";
    maxAccuracy: number;
    printTitle: string;
    orgName: string;
    defaultScheduleId: number | null;
    appDownloadUrl: string;
    webClockIn: boolean;
  };
  zones: Zone[];
  schedules: Array<Schedule & { staffCount: number }>;
  holidays: Array<{ date: string; name: string }>;
  demoAvailable: boolean;
};

export default function SettingsAdmin() {
  const toast = useToast();
  const [data, setData] = useState<Settings | null>(null);
  const load = useCallback(async () => {
    try {
      setData(await api<Settings>("/api/admin/settings"));
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }, [toast]);
  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return (
      <div className="grid place-items-center py-24">
        <Spinner />
      </div>
    );
  }
  return (
    <div>
      <PageHead title="Settings" sub="The staff app, where staff can clock in, working hours, holidays and the printed form." />
      <div className="grid gap-5">
        <AppPanel settings={data.settings} onChange={load} />
        <ZonesPanel zones={data.zones} onChange={load} />
        <div className="grid gap-5 lg:grid-cols-2">
          <RulesPanel settings={data.settings} onChange={load} />
          <PrintPanel settings={data.settings} onChange={load} />
        </div>
        <SchedulesPanel schedules={data.schedules} defaultId={data.settings.defaultScheduleId} onChange={load} />
        <HolidaysPanel holidays={data.holidays} onChange={load} />
        {data.demoAvailable && <DemoPanel onChange={load} />}
      </div>
    </div>
  );
}

function useSave() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await fn();
      toast(done);
      return true;
    } catch (e) {
      toast(errorMessage(e), "error");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

/* ---------------- Staff app ---------------- */

function AppPanel({ settings, onChange }: { settings: Settings["settings"]; onChange: () => void }) {
  const { busy, run } = useSave();
  const [url, setUrl] = useState(settings.appDownloadUrl);
  const [web, setWeb] = useState(settings.webClockIn);
  return (
    <Panel
      title="Staff app"
      actions={
        <a href="/app" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-iris-600 hover:underline">
          <Smartphone className="size-4" /> Open the staff app page
        </a>
      }
    >
      <form
        className="grid gap-4 p-4 lg:grid-cols-[1fr_1fr]"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => api("/api/admin/settings", { method: "PUT", body: { appDownloadUrl: url.trim(), webClockIn: web } }), "Staff app settings saved")) onChange();
        }}
      >
        <div className="flex flex-col gap-3">
          <Field
            label="Android app download link"
            hint="Paste the APK link from your Expo build page, or a Google Drive share link to the APK. Staff see it on the staff app page, with a QR code."
          >
            {(id) => <Input id={id} type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://expo.dev/artifacts/…" />}
          </Field>
        </div>
        <div className="flex flex-col gap-3">
          <label className={cx("flex cursor-pointer gap-3 rounded-xl p-3.5 ring-1", web ? "bg-gold-50 ring-gold-300" : "ring-navy-100")}>
            <input type="checkbox" checked={web} onChange={(e) => setWeb(e.target.checked)} className="mt-1 size-4 accent-navy-800" />
            <span>
              <span className="block text-[14.5px] font-semibold text-navy-900">Also allow clocking in on the website</span>
              <span className="block text-[12.5px] leading-snug text-slate-500">
                Off: staff can only clock in with the phone app, which detects fake-GPS apps. On: every staff member can also use the website, so turn it on only while someone can&apos;t install the app yet (for example an iPhone user).
              </span>
            </span>
          </label>
          <Button type="submit" loading={busy} className="self-start">
            Save
          </Button>
        </div>
      </form>
    </Panel>
  );
}

/* ---------------- Zones ---------------- */

const NO_ZONES: MapZone[] = [];
const round7 = (x: number) => Math.round(x * 1e7) / 1e7;

function zoneSummary(z: Zone) {
  if (isArea(z)) return `Drawn area, ${z.polygon.length} corners, ${fmtArea(areaInfo(z.polygon).areaM2)}`;
  return `${z.radius_m} m radius, ${z.lat.toFixed(5)}, ${z.lng.toFixed(5)}`;
}

function ZonesPanel({ zones, onChange }: { zones: Zone[]; onChange: () => void }) {
  const [edit, setEdit] = useState<Partial<Zone> | null>(null);
  return (
    <Panel
      title="Attendance zone"
      actions={
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setEdit({ name: "", lat: zones[0]?.lat ?? 5.9458845, lng: zones[0]?.lng ?? 116.070886, radius_m: 150, polygon: null, active: true })}
        >
          <Plus className="size-4" /> Add zone
        </Button>
      }
      className="overflow-hidden"
    >
      <div className="grid lg:grid-cols-[1fr_380px]">
        <div className="relative h-[320px] border-b border-navy-50 lg:border-b-0 lg:border-r">
          <MapView className="absolute inset-0" zones={zones} fit="zones" />
        </div>
        <div>
          <p className="px-4 pt-3 text-[13px] leading-relaxed text-slate-600">
            Clocking in inside a zone counts as <span className="font-semibold text-teal-700">Internal</span>. Anywhere else is{" "}
            <span className="font-semibold text-gold-700">External</span>. A zone can be a circle, or an area you draw around the school.
          </p>
          <ul className="mt-2">
            {zones.map((z) => (
              <li key={z.id} className="flex items-center gap-3 border-t border-navy-50 px-4 py-3">
                {isArea(z) ? (
                  <Pentagon className={cx("size-5 shrink-0", z.active ? "text-teal-600" : "text-slate-300")} />
                ) : (
                  <MapPinned className={cx("size-5 shrink-0", z.active ? "text-teal-600" : "text-slate-300")} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-navy-900">{z.name}</p>
                  <p className="text-[12.5px] text-slate-500 tabular">
                    {zoneSummary(z)}
                    {!z.active && ", switched off"}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setEdit(z)} aria-label={`Edit ${z.name}`}>
                  <Pencil className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <ZoneSheet zone={edit} onClose={() => setEdit(null)} onSaved={() => (setEdit(null), onChange())} />
    </Panel>
  );
}

type Shape = "circle" | "area";

function ZoneSheet({ zone, onClose, onSaved }: { zone: Partial<Zone> | null; onClose: () => void; onSaved: () => void }) {
  const { busy, run } = useSave();
  const toast = useToast();
  const [f, setF] = useState<Partial<Zone>>({});
  const [shape, setShape] = useState<Shape>("circle");
  // The drawn outline, with earlier versions for Undo.
  const [outline, setOutline] = useState<{ corners: LatLng[]; past: LatLng[][] }>({ corners: [], past: [] });
  const [locating, setLocating] = useState(false);
  const [recenter, setRecenter] = useState(0);
  useEffect(() => {
    if (!zone) return;
    setF(zone);
    setShape(isArea(zone) ? "area" : "circle");
    setOutline({ corners: zone.polygon ?? [], past: [] });
  }, [zone]);

  const corners = outline.corners;
  const info = useMemo(() => (corners.length >= 3 ? areaInfo(corners) : null), [corners]);
  const editOutline = (next: (c: LatLng[]) => LatLng[]) =>
    setOutline((o) => ({ corners: next(o.corners), past: [...o.past.slice(-49), o.corners] }));
  const undo = () => setOutline((o) => (o.past.length ? { corners: o.past[o.past.length - 1], past: o.past.slice(0, -1) } : o));

  const preview = useMemo(
    () => (f.lat != null && f.lng != null ? [{ id: f.id ?? 0, name: f.name || "New zone", lat: f.lat, lng: f.lng, radius_m: f.radius_m ?? 150 }] : []),
    [f.id, f.name, f.lat, f.lng, f.radius_m],
  );

  function locate(then: (lat: number, lng: number, accuracy: number) => void) {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        then(round7(p.coords.latitude), round7(p.coords.longitude), Math.round(p.coords.accuracy));
      },
      () => {
        setLocating(false);
        toast("Couldn't get your location. Allow location access and try again.", "error");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }
  const useHere = () =>
    locate((lat, lng, acc) => {
      setF((x) => ({ ...x, lat, lng }));
      setRecenter((n) => n + 1);
      toast(`Centre set to your position (±${acc} m)`, "info");
    });
  const addHere = () =>
    locate((lat, lng, acc) => {
      editOutline((c) => [...c, [lat, lng]]);
      setRecenter((n) => n + 1);
      toast(`Corner added at your position (±${acc} m)`, "info");
    });
  const switchShape = (next: Shape) => {
    setShape(next);
    setRecenter((n) => n + 1);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    let body;
    if (shape === "area") {
      if (!info) return toast("Tap at least 3 corners of the area on the map.", "error");
      if (info.crosses) return toast("The outline crosses itself. Drag the corners so the edges don't cross.", "error");
      body = {
        name: f.name,
        lat: round7(info.centre[0]),
        lng: round7(info.centre[1]),
        radius_m: Math.min(5000, Math.max(20, Math.ceil(info.extentM))),
        polygon: corners,
        active: f.active ?? true,
      };
    } else {
      body = { name: f.name, lat: Number(f.lat), lng: Number(f.lng), radius_m: Number(f.radius_m), polygon: null, active: f.active ?? true };
    }
    const ok = await run(
      () => (f.id ? api(`/api/admin/zones/${f.id}`, { method: "PATCH", body }) : api("/api/admin/zones", { body })),
      f.id ? "Zone saved" : "Zone added",
    );
    if (ok) onSaved();
  }
  async function remove() {
    if (!f.id) return;
    const ok = await run(() => api(`/api/admin/zones/${f.id}`, { method: "DELETE" }), "Zone deleted");
    if (ok) onSaved();
  }

  const mapHint =
    shape === "circle"
      ? "Tap the map to move the centre"
      : corners.length === 0
        ? "Tap the map at each corner of the school"
        : corners.length < 3
          ? "Keep tapping to add corners (at least 3)"
          : "Drag a corner to move it. Tap + to add a corner, double-click a corner to remove it.";

  return (
    <Sheet open={!!zone} onClose={onClose} title={f.id ? "Edit zone" : "Add zone"} wide>
      <form onSubmit={save} className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px] font-semibold text-navy-900">Shape</span>
          <Segmented<Shape>
            value={shape}
            onChange={switchShape}
            options={[
              { value: "circle", label: "Circle" },
              { value: "area", label: "Draw area" },
            ]}
          />
        </div>
        <div className="relative h-[340px] overflow-hidden rounded-2xl ring-1 ring-navy-100">
          <MapView
            className="absolute inset-0"
            zones={shape === "circle" ? preview : NO_ZONES}
            me={shape === "circle" && f.lat != null && f.lng != null ? { lat: f.lat, lng: f.lng, accuracy: 0 } : null}
            fit={shape === "circle" ? "me" : "zones"}
            recenterKey={recenter}
            onPick={shape === "circle" ? (lat, lng) => setF((x) => ({ ...x, lat: round7(lat), lng: round7(lng) })) : undefined}
            draw={shape === "area" ? { points: corners, onChange: (next) => editOutline(() => next), label: f.name || "New zone" } : undefined}
          />
          <p className="pointer-events-none absolute inset-x-0 bottom-0 z-[500] bg-gradient-to-t from-navy-950/60 to-transparent px-3 pb-2 pt-6 text-[12.5px] font-medium text-white">
            {mapHint}
          </p>
        </div>
        {shape === "area" ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-auto text-[13.5px] text-navy-900 tabular" aria-live="polite">
                <span className="font-semibold">
                  {corners.length} corner{corners.length === 1 ? "" : "s"}
                </span>
                {info ? <span className="text-slate-500"> · {fmtArea(info.areaM2)}</span> : <span className="text-slate-500"> · at least 3 needed</span>}
              </p>
              <Button type="button" size="sm" variant="secondary" onClick={undo} disabled={!outline.past.length}>
                <Undo2 className="size-4" /> Undo
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => editOutline(() => [])} disabled={!corners.length}>
                <Eraser className="size-4" /> Clear
              </Button>
            </div>
            {info?.crosses && (
              <p className="rounded-xl bg-danger-50 px-3.5 py-2.5 text-[13px] font-medium text-danger-700" role="alert">
                The outline crosses itself. Drag the corners so the edges don&apos;t cross.
              </p>
            )}
            <Button type="button" variant="secondary" onClick={addHere} loading={locating}>
              {!locating && <Crosshair className="size-4" />} Add my current location as a corner
            </Button>
            <p className="-mt-2 text-[12.5px] leading-snug text-slate-500">
              Draw a little outside the fence and buildings: GPS indoors can be 20–50 m off. You can also walk the boundary with
              your phone and add each corner where you stand.
            </p>
          </>
        ) : (
          <Button type="button" variant="secondary" onClick={useHere} loading={locating}>
            {!locating && <Crosshair className="size-4" />} Use my current location as the centre
          </Button>
        )}
        <Field label="Name" hint="Shown on the map and saved with each clock-in.">
          {(id) => <Input id={id} value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} placeholder="DAICOE AI Center, KKHS" />}
        </Field>
        {shape === "circle" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Latitude">{(id) => <Input id={id} type="number" step="any" value={f.lat ?? ""} onChange={(e) => setF({ ...f, lat: Number(e.target.value) })} required />}</Field>
              <Field label="Longitude">{(id) => <Input id={id} type="number" step="any" value={f.lng ?? ""} onChange={(e) => setF({ ...f, lng: Number(e.target.value) })} required />}</Field>
            </div>
            <Field label={`Radius: ${f.radius_m ?? 150} m`} hint="Big enough to cover the building and car park. GPS indoors can be 20–50 m off.">
              {(id) => (
                <input
                  id={id}
                  type="range"
                  min={30}
                  max={1000}
                  step={10}
                  value={f.radius_m ?? 150}
                  onChange={(e) => setF({ ...f, radius_m: Number(e.target.value) })}
                  className="w-full accent-teal-600"
                />
              )}
            </Field>
          </>
        )}
        {f.id && (
          <label className="flex items-center gap-3 rounded-xl bg-navy-50 px-3.5 py-3 text-[14px] font-medium text-navy-900">
            <input type="checkbox" checked={f.active ?? true} onChange={(e) => setF({ ...f, active: e.target.checked })} className="size-5 accent-navy-800" />
            Zone is active
          </label>
        )}
        <Button type="submit" size="lg" loading={busy}>
          Save zone
        </Button>
        {f.id && (
          <button type="button" onClick={remove} className="inline-flex items-center justify-center gap-1.5 text-[13.5px] font-semibold text-danger-600">
            <Trash2 className="size-4" /> Delete zone
          </button>
        )}
      </form>
    </Sheet>
  );
}

/* ---------------- Rules ---------------- */

function RulesPanel({ settings, onChange }: { settings: Settings["settings"]; onChange: () => void }) {
  const { busy, run } = useSave();
  const [policy, setPolicy] = useState(settings.outsideZonePolicy);
  const [acc, setAcc] = useState(String(settings.maxAccuracy));
  return (
    <Panel title="Clocking in outside the zone">
      <form
        className="flex flex-col gap-3 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => api("/api/admin/settings", { method: "PUT", body: { outsideZonePolicy: policy, maxAccuracy: Number(acc) } }), "Rules saved")) onChange();
        }}
      >
        {(
          [
            ["reason", "Allow, marked External", "Staff must type a reason, e.g. a course at another school. It prints in Perkara Khas."],
            ["block", "Don't allow", "The Clock In button only works inside a zone."],
          ] as const
        ).map(([v, label, hint]) => (
          <label key={v} className={cx("flex cursor-pointer gap-3 rounded-xl p-3.5 ring-1", policy === v ? "bg-navy-50 ring-navy-300" : "ring-navy-100")}>
            <input type="radio" name="policy" checked={policy === v} onChange={() => setPolicy(v)} className="mt-1 size-4 accent-navy-800" />
            <span>
              <span className="block text-[14.5px] font-semibold text-navy-900">{label}</span>
              <span className="block text-[12.5px] leading-snug text-slate-500">{hint}</span>
            </span>
          </label>
        ))}
        <Field label="Reject locations less accurate than (metres)" hint="Stops clock-ins from rough Wi-Fi or IP-based locations. 1000 m suits most phones.">
          {(id) => <Input id={id} type="number" min={20} max={100000} value={acc} onChange={(e) => setAcc(e.target.value)} required />}
        </Field>
        <Button type="submit" loading={busy} className="self-start">
          Save rules
        </Button>
      </form>
    </Panel>
  );
}

function PrintPanel({ settings, onChange }: { settings: Settings["settings"]; onChange: () => void }) {
  const { busy, run } = useSave();
  const [title, setTitle] = useState(settings.printTitle);
  const [org, setOrg] = useState(settings.orgName);
  return (
    <Panel title="Printed form">
      <form
        className="flex flex-col gap-3 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => api("/api/admin/settings", { method: "PUT", body: { printTitle: title, orgName: org } }), "Saved")) onChange();
        }}
      >
        <Field label="Title above each week" hint="Matches the LPS paper form by default.">
          {(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} />}
        </Field>
        <Field label="Organisation name" hint="Shown in the app and in the small print at the bottom of each page.">
          {(id) => <Input id={id} value={org} onChange={(e) => setOrg(e.target.value)} required minLength={2} />}
        </Field>
        <Button type="submit" loading={busy} className="self-start">
          Save
        </Button>
      </form>
    </Panel>
  );
}

/* ---------------- Working hours ---------------- */

type SchedForm = { id?: number; code: string; start_time: string; end_time: string; grace_minutes: number; work_days: number[] };

function SchedulesPanel({ schedules, defaultId, onChange }: { schedules: Array<Schedule & { staffCount: number }>; defaultId: number | null; onChange: () => void }) {
  const { busy, run } = useSave();
  const [form, setForm] = useState<SchedForm | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const body = { code: form.code, start_time: form.start_time, end_time: form.end_time, grace_minutes: Number(form.grace_minutes), work_days: form.work_days };
    const ok = await run(
      () => (form.id ? api(`/api/admin/schedules/${form.id}`, { method: "PATCH", body }) : api("/api/admin/schedules", { body })),
      "Working hours saved",
    );
    if (ok) {
      setForm(null);
      onChange();
    }
  }

  return (
    <Panel
      title="Working hours"
      actions={
        <div className="flex items-center gap-2">
          <Select
            aria-label="Default slot for new staff"
            className="h-9 w-auto text-[13.5px]"
            value={defaultId ?? ""}
            onChange={async (e) => {
              if (await run(() => api("/api/admin/settings", { method: "PUT", body: { defaultScheduleId: Number(e.target.value) } }), "Default slot changed")) onChange();
            }}
          >
            {schedules.map((s) => (
              <option key={s.id} value={s.id}>
                Default: {s.code}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="secondary" onClick={() => setForm({ code: "", start_time: "08:00", end_time: "17:00", grace_minutes: 0, work_days: [1, 2, 3, 4, 5] })}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[14px]">
          <thead className="text-[12px] text-slate-500">
            <tr className="border-b border-navy-50">
              <th className="px-4 py-2.5 font-semibold">Slot</th>
              <th className="px-3 py-2.5 font-semibold">Hours</th>
              <th className="px-3 py-2.5 font-semibold">Late after</th>
              <th className="px-3 py-2.5 font-semibold">Work days</th>
              <th className="px-3 py-2.5 font-semibold">Staff</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {schedules.map((s) => (
              <tr key={s.id} className="border-b border-navy-50 last:border-0">
                <td className="px-4 py-3 font-bold text-navy-900">
                  {s.code}
                  {s.id === defaultId && <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-700">Default</span>}
                </td>
                <td className="px-3 py-3 tabular">
                  {hm12(s.start_time)} – {hm12(s.end_time)}
                </td>
                <td className="px-3 py-3 tabular">{s.grace_minutes ? `${s.grace_minutes} min grace` : "Start time"}</td>
                <td className="px-3 py-3">
                  <span className="flex gap-1">
                    {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                      <span key={d} className={cx("grid size-6 place-items-center rounded-md text-[11px] font-bold", s.work_days.includes(d) ? "bg-navy-800 text-white" : "bg-navy-50 text-slate-400")}>
                        {ENGLISH_DAYS[d - 1][0]}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="px-3 py-3 tabular">{s.staffCount}</td>
                <td className="px-4 py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => setForm({ id: s.id, code: s.code, start_time: s.start_time, end_time: s.end_time, grace_minutes: s.grace_minutes, work_days: s.work_days })}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${s.code}`}
                    onClick={async () => {
                      if (await run(() => api(`/api/admin/schedules/${s.id}`, { method: "DELETE" }), "Slot deleted")) onChange();
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Sheet open={!!form} onClose={() => setForm(null)} title={form?.id ? "Edit working hours" : "Add working hours"}>
        {form && (
          <form onSubmit={save} className="flex flex-col gap-4">
            <Field label="Code" hint="Short name, e.g. WP2.">
              {(id) => <Input id={id} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required maxLength={12} />}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start">{(id) => <Input id={id} type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required />}</Field>
              <Field label="End">{(id) => <Input id={id} type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} required />}</Field>
            </div>
            <Field label="Grace period (minutes)" hint="Clocking in within this many minutes after the start isn't counted as late.">
              {(id) => <Input id={id} type="number" min={0} max={120} value={form.grace_minutes} onChange={(e) => setForm({ ...form, grace_minutes: Number(e.target.value) })} />}
            </Field>
            <fieldset>
              <legend className="mb-2 text-[13px] font-semibold text-navy-900">Work days</legend>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => {
                  const on = form.work_days.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setForm({ ...form, work_days: on ? form.work_days.filter((x) => x !== d) : [...form.work_days, d].sort() })}
                      className={cx("rounded-xl px-3 py-2 text-[13.5px] font-semibold ring-1", on ? "bg-navy-800 text-white ring-navy-800" : "bg-white text-navy-700 ring-navy-200")}
                    >
                      {ENGLISH_DAYS[d - 1].slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <Button type="submit" size="lg" loading={busy}>
              Save working hours
            </Button>
          </form>
        )}
      </Sheet>
    </Panel>
  );
}

/* ---------------- Holidays ---------------- */

function HolidaysPanel({ holidays, onChange }: { holidays: Array<{ date: string; name: string }>; onChange: () => void }) {
  const { busy, run } = useSave();
  const years = [...new Set(holidays.map((h) => h.date.slice(0, 4)))].sort();
  const thisYear = String(new Date().getFullYear());
  const [year, setYear] = useState(years.includes(thisYear) ? thisYear : years[years.length - 1] ?? thisYear);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const list = holidays.filter((h) => h.date.startsWith(year));

  return (
    <Panel
      title="Public holidays"
      actions={
        years.length > 1 ? (
          <Select aria-label="Year" className="h-9 w-auto text-[13.5px]" value={year} onChange={(e) => setYear(e.target.value)}>
            {years.map((y) => (
              <option key={y}>{y}</option>
            ))}
          </Select>
        ) : null
      }
    >
      <form
        className="flex flex-wrap items-end gap-3 border-b border-navy-50 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => api("/api/admin/holidays", { body: { date, name } }), "Holiday saved")) {
            setDate("");
            setName("");
            setYear(date.slice(0, 4));
            onChange();
          }
        }}
      >
        <Field label="Date" className="w-44">
          {(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />}
        </Field>
        <Field label="Name" className="min-w-52 flex-1">
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} required minLength={2} placeholder="Hari Krismas" />}
        </Field>
        <Button type="submit" loading={busy}>
          <Plus className="size-4" /> Add holiday
        </Button>
      </form>
      <p className="px-4 pt-3 text-[12.5px] text-slate-500">
        Sabah holidays for 2026 are included. Add next year&apos;s once they are gazetted. Holidays print as &quot;Cuti Umum&quot; in Perkara Khas.
      </p>
      <ul className="grid gap-x-6 p-2 sm:grid-cols-2">
        {list.map((h) => (
          <li key={h.date} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-navy-50/60">
            <span className="w-24 shrink-0 text-[13.5px] font-semibold text-navy-900 tabular">{dmy(h.date)}</span>
            <span className="w-9 shrink-0 text-[12px] text-slate-500">{ENGLISH_DAYS[isoDow(h.date) - 1].slice(0, 3)}</span>
            <span className="min-w-0 flex-1 truncate text-[14px] text-navy-800">{h.name}</span>
            <button
              type="button"
              aria-label={`Delete ${h.name}`}
              onClick={async () => {
                if (await run(() => api(`/api/admin/holidays/${h.date}`, { method: "DELETE" }), "Holiday removed")) onChange();
              }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-danger-600"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="px-2 py-3 text-[13.5px] text-slate-500">No holidays for {year}.</li>}
      </ul>
    </Panel>
  );
}

/* ---------------- Demo ---------------- */

function DemoPanel({ onChange }: { onChange: () => void }) {
  const { busy, run } = useSave();
  return (
    <Panel title="Demo data">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <p className="min-w-60 flex-1 text-[13.5px] leading-relaxed text-slate-600">
          Adds four demo staff (DEMO-01 to DEMO-04, password demo12345) with five weeks of records so you can try the reports and printing.
          Only available in development or when DEMO_MODE=1.
        </p>
        <Button variant="secondary" loading={busy} onClick={async () => (await run(() => api("/api/admin/demo", { body: { action: "seed" } }), "Demo staff added")) && onChange()}>
          Add demo staff
        </Button>
        <Button variant="ghost" loading={busy} onClick={async () => (await run(() => api("/api/admin/demo", { body: { action: "remove" } }), "Demo staff removed")) && onChange()}>
          Remove demo staff
        </Button>
      </div>
    </Panel>
  );
}
