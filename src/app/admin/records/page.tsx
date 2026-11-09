"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CalendarX2, Download, Pencil, Plus, Printer, Smartphone, Trash2 } from "lucide-react";
import { PageHead, Panel } from "@/components/admin-shell";
import { DayDetailSheet, DayFlags } from "@/components/day-detail";
import { MonthSwitcher } from "@/components/month-switcher";
import { Button, EmptyState, Field, Input, Select, Sheet, Spinner, StatusChip, Textarea, buttonClass, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { api, errorMessage } from "@/lib/api";
import { STATUS_LABEL, type DayView } from "@/lib/rules";
import { currentMonth, dmy, fmt12, fmtDuration, mytDate, mytHM } from "@/lib/time";

type Row = { staff: { id: number; name: string; staffNo: string }; day: DayView; sharedDevice: boolean };
type Data = {
  from: string;
  to: string;
  rows: Row[];
  summary: { present: number; late: number; external: number; leave: number; absent: number; workedMins: number; workdays: number } | null;
  staffOptions: Array<{ id: number; name: string; staffNo: string; active: boolean }>;
};

export default function RecordsAdmin() {
  const toast = useToast();
  const [month, setMonth] = useState(currentMonth());
  const [staff, setStaff] = useState("all");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<DayView | null>(null);
  const [edit, setEdit] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);

  const query = `staff=${staff}&month=${month}`;
  const load = useCallback(async () => {
    try {
      setData(await api<Data>(`/api/admin/records?${query}`));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [query]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const today = mytDate();
  const rows = (data?.rows ?? []).filter((r) => r.day.date <= today && r.day.status !== "untracked");

  return (
    <div>
      <PageHead
        title="Records"
        sub="Every clock-in and clock-out, with the GPS position it was made from."
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
              <Plus className="size-4" /> Add record
            </Button>
            <a href={`/api/admin/records/export?${query}`} className={buttonClass("secondary", "sm")}>
              <Download className="size-4" /> Excel (CSV)
            </a>
            <Link href={`/print?staff=${staff}&month=${month}`} className={buttonClass("primary", "sm")}>
              <Printer className="size-4" /> Print forms
            </Link>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_320px]">
        <Select value={staff} onChange={(e) => setStaff(e.target.value)} aria-label="Staff member">
          <option value="all">All staff</option>
          {data?.staffOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.staffNo}){s.active ? "" : ", switched off"}
            </option>
          ))}
        </Select>
        <MonthSwitcher month={month} onChange={setMonth} />
      </div>

      {data?.summary && (
        <dl className="mb-4 grid grid-cols-3 gap-px overflow-hidden rounded-2xl bg-navy-100 ring-1 ring-navy-100 sm:grid-cols-6">
          {[
            ["Present", `${data.summary.present}/${data.summary.workdays}`],
            ["Late", data.summary.late],
            ["External", data.summary.external],
            ["On leave", data.summary.leave],
            ["Absent", data.summary.absent],
            ["Hours", fmtDuration(data.summary.workedMins)],
          ].map(([k, v]) => (
            <div key={k} className="bg-white px-4 py-2.5">
              <dt className="text-[12px] font-medium text-slate-500">{k}</dt>
              <dd className="text-[19px] font-bold text-navy-900 tabular">{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <Panel>
        {error && <p className="p-4 text-danger-600">{error}</p>}
        {!data && !error && (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        )}
        {data && rows.length === 0 && <EmptyState icon={<CalendarX2 className="size-6" />} title="No records for this month" />}
        {data && rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[13.5px]">
              <thead className="text-[12px] text-slate-500">
                <tr className="border-b border-navy-50">
                  <th className="px-4 py-2.5 font-semibold">Date</th>
                  {staff === "all" && <th className="px-3 py-2.5 font-semibold">Staff</th>}
                  <th className="px-3 py-2.5 font-semibold">In</th>
                  <th className="px-3 py-2.5 font-semibold">Out</th>
                  <th className="px-3 py-2.5 font-semibold">Hours</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">Perkara Khas</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.staff.id}-${r.day.date}`} className="border-b border-navy-50 align-top last:border-0 hover:bg-navy-50/40">
                    <td className="whitespace-nowrap px-4 py-3">
                      <button type="button" onClick={() => setView(r.day)} className="text-left font-semibold text-navy-900 hover:text-iris-600">
                        {dmy(r.day.date)}
                        <span className="block text-[12px] font-normal text-slate-500">{r.day.dayMs}</span>
                      </button>
                    </td>
                    {staff === "all" && (
                      <td className="px-3 py-3">
                        <span className="font-semibold text-navy-900">{r.staff.name}</span>
                        <span className="block text-[12px] text-slate-500">{r.staff.staffNo}</span>
                      </td>
                    )}
                    <td className="whitespace-nowrap px-3 py-3 tabular">
                      <Punch at={r.day.clockIn} zone={r.day.record?.in_zone ?? null} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 tabular">
                      <Punch at={r.day.clockOut} zone={r.day.record?.out_zone ?? null} />
                    </td>
                    <td className="px-3 py-3 font-semibold tabular text-navy-800">{r.day.clockOut ? fmtDuration(r.day.workedMins) : ""}</td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        <StatusChip status={r.day.status} label={STATUS_LABEL[r.day.status]} />
                        <DayFlags day={r.day} />
                        {r.sharedDevice && (
                          <span title="The same phone or browser was used by another staff member that day" className="inline-flex items-center gap-1 rounded-md bg-danger-100 px-1.5 py-0.5 text-[11.5px] font-semibold text-danger-700">
                            <Smartphone className="size-3" /> Shared device
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="max-w-[260px] px-3 py-3 text-[12.5px] leading-snug text-slate-600">{r.day.remarkMs}</td>
                    <td className="px-4 py-3 text-right">
                      {r.day.record && (
                        <Button size="sm" variant="ghost" onClick={() => setEdit(r)} aria-label="Edit record">
                          <Pencil className="size-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <DayDetailSheet day={view} onClose={() => setView(null)} canCorrect={false} />
      <EditRecordSheet
        row={edit}
        onClose={() => setEdit(null)}
        onSaved={(msg) => {
          setEdit(null);
          toast(msg);
          load();
        }}
      />
      <AddRecordSheet
        open={adding}
        staffOptions={data?.staffOptions.filter((s) => s.active) ?? []}
        defaultStaff={staff}
        onClose={() => setAdding(false)}
        onSaved={() => {
          setAdding(false);
          toast("Record added");
          load();
        }}
      />
    </div>
  );
}

function Punch({ at, zone }: { at: string | null; zone: "internal" | "external" | null }) {
  if (!at) return <span className="text-slate-300">--:--</span>;
  return (
    <span className="flex items-center gap-1.5">
      <span className={cx("size-2 rounded-full", zone === "external" ? "bg-gold-500" : zone === "internal" ? "bg-teal-500" : "bg-slate-300")} />
      <span className="font-semibold text-navy-900">{fmt12(new Date(at))}</span>
    </span>
  );
}

function EditRecordSheet({ row, onClose, onSaved }: { row: Row | null; onClose: () => void; onSaved: (msg: string) => void }) {
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [remark, setRemark] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!row) return;
    setClockIn(row.day.clockIn ? mytHM(new Date(row.day.clockIn)) : "");
    setClockOut(row.day.clockOut ? mytHM(new Date(row.day.clockOut)) : "");
    setRemark(row.day.record?.remark ?? "");
    setReason("");
    setError(null);
    setConfirmDelete(false);
  }, [row]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!row?.day.record) return;
    setBusy(true);
    setError(null);
    try {
      if (confirmDelete) {
        await api(`/api/admin/records/${row.day.record.id}`, { method: "DELETE", body: { reason } });
        onSaved("Record deleted");
      } else {
        await api(`/api/admin/records/${row.day.record.id}`, {
          method: "PATCH",
          body: { clockIn: clockIn || null, clockOut: clockOut || null, remark: remark || null, reason },
        });
        onSaved("Record updated");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={!!row} onClose={onClose} title={row ? `${row.staff.name}, ${dmy(row.day.date)}` : ""}>
      <form onSubmit={save} className="flex flex-col gap-4">
        {!confirmDelete && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Clock in">{(id) => <Input id={id} type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />}</Field>
              <Field label="Clock out">{(id) => <Input id={id} type="time" value={clockOut} onChange={(e) => setClockOut(e.target.value)} />}</Field>
            </div>
            <Field label="Admin note" hint="Added to Perkara Khas on the printout.">
              {(id) => <Input id={id} value={remark} onChange={(e) => setRemark(e.target.value)} maxLength={300} />}
            </Field>
          </>
        )}
        <Field label={confirmDelete ? "Why delete this record?" : "Why change it?"} hint="Kept in the audit log.">
          {(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} className="min-h-20" />}
        </Field>
        {error && <p className="rounded-xl bg-danger-50 px-3.5 py-2.5 text-[13.5px] font-medium text-danger-700">{error}</p>}
        <Button type="submit" size="lg" variant={confirmDelete ? "danger" : "primary"} loading={busy}>
          {confirmDelete ? "Delete record" : "Save changes"}
        </Button>
        <button
          type="button"
          onClick={() => setConfirmDelete((d) => !d)}
          className="inline-flex items-center justify-center gap-1.5 text-[13.5px] font-semibold text-danger-600"
        >
          {confirmDelete ? (
            "Keep the record"
          ) : (
            <>
              <Trash2 className="size-4" /> Delete this record instead
            </>
          )}
        </button>
      </form>
    </Sheet>
  );
}

function AddRecordSheet({
  open,
  staffOptions,
  defaultStaff,
  onClose,
  onSaved,
}: {
  open: boolean;
  staffOptions: Array<{ id: number; name: string; staffNo: string }>;
  defaultStaff: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [staffId, setStaffId] = useState("");
  const [date, setDate] = useState(mytDate());
  const [clockIn, setClockIn] = useState("08:00");
  const [clockOut, setClockOut] = useState("17:00");
  const [remark, setRemark] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStaffId(defaultStaff !== "all" ? defaultStaff : String(staffOptions[0]?.id ?? ""));
    setDate(mytDate());
    setRemark("");
    setReason("");
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/admin/records", {
        body: { staffId: Number(staffId), date, clockIn: clockIn || null, clockOut: clockOut || null, remark: remark || undefined, reason },
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Add a record by hand">
      <form onSubmit={save} className="flex flex-col gap-4">
        <p className="text-[13.5px] leading-relaxed text-slate-600">For days the app couldn&apos;t be used. It has no GPS position and prints with &quot;Direkod oleh admin&quot;.</p>
        <Field label="Staff">
          {(id) => (
            <Select id={id} value={staffId} onChange={(e) => setStaffId(e.target.value)} required>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.staffNo})
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Date">{(id) => <Input id={id} type="date" value={date} max={mytDate()} onChange={(e) => setDate(e.target.value)} required />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Clock in">{(id) => <Input id={id} type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)} />}</Field>
          <Field label="Clock out">{(id) => <Input id={id} type="time" value={clockOut} onChange={(e) => setClockOut(e.target.value)} />}</Field>
        </div>
        <Field label="Admin note (optional)">{(id) => <Input id={id} value={remark} onChange={(e) => setRemark(e.target.value)} maxLength={300} />}</Field>
        <Field label="Why are you adding it?" hint="Kept in the audit log.">
          {(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} className="min-h-20" />}
        </Field>
        {error && <p className="rounded-xl bg-danger-50 px-3.5 py-2.5 text-[13.5px] font-medium text-danger-700">{error}</p>}
        <Button type="submit" size="lg" loading={busy}>
          Add record
        </Button>
      </form>
    </Sheet>
  );
}
