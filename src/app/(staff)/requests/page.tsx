"use client";

import { useCallback, useEffect, useState } from "react";
import { FilePenLine, Plus } from "lucide-react";
import { TopBar } from "@/components/staff-shell";
import { Button, EmptyState, Field, Input, Sheet, Spinner, Textarea, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { api, errorMessage } from "@/lib/api";
import { REQUEST_TYPES, REQUEST_TYPE_KEYS, type RequestType } from "@/lib/rules";
import { dmy, hm12, mytDate } from "@/lib/time";

type Req = {
  id: number;
  type: RequestType;
  date_from: string;
  date_to: string;
  time_in: string | null;
  time_out: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  review_note: string | null;
  reviewer: string | null;
  created_at: string;
};

const STATUS: Record<Req["status"], { label: string; cls: string }> = {
  pending: { label: "Waiting for approval", cls: "bg-gold-100 text-gold-700" },
  approved: { label: "Approved", cls: "bg-teal-100 text-teal-700" },
  rejected: { label: "Not approved", cls: "bg-danger-100 text-danger-700" },
  cancelled: { label: "Withdrawn", cls: "bg-slate-100 text-slate-500" },
};

export default function RequestsPage() {
  const toast = useToast();
  const [items, setItems] = useState<Req[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ type: RequestType; date: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api<{ requests: Req[] }>("/api/requests");
      setItems(res.requests);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    load();
    const q = new URLSearchParams(window.location.search);
    const t = q.get("new") as RequestType | null;
    if (t && REQUEST_TYPE_KEYS.includes(t)) setForm({ type: t, date: q.get("date") ?? mytDate() });
  }, [load]);

  async function withdraw(id: number) {
    try {
      await api(`/api/requests/${id}`, { method: "DELETE" });
      toast("Request withdrawn");
      load();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  return (
    <div>
      <TopBar
        title="Requests"
        right={
          <Button size="sm" onClick={() => setForm({ type: "cuti", date: mytDate() })} className="mr-1">
            <Plus className="size-4" /> New
          </Button>
        }
      />
      <div className="flex flex-col gap-3 px-4">
        <p className="text-[13.5px] leading-relaxed text-slate-600">
          Leave, MC, courses, outside duty and time corrections. Approved requests fill the Perkara Khas column on your printed record.
        </p>
        {error && <p className="rounded-xl bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</p>}
        {!items && !error && (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        )}
        {items?.length === 0 && (
          <EmptyState icon={<FilePenLine className="size-6" />} title="No requests yet">
            Tap New to apply for leave or fix a clock-in time.
          </EmptyState>
        )}
        {items?.map((r) => (
          <article key={r.id} className="rounded-2xl bg-white p-4 ring-1 ring-navy-100">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[15.5px] font-bold text-navy-900">{REQUEST_TYPES[r.type].en}</h3>
                <p className="text-[13.5px] font-medium text-navy-700 tabular">
                  {r.date_from === r.date_to ? dmy(r.date_from) : `${dmy(r.date_from)} to ${dmy(r.date_to)}`}
                  {r.type === "pembetulan" && (
                    <span className="text-slate-500">
                      {r.time_in ? `, in ${hm12(r.time_in)}` : ""}
                      {r.time_out ? `, out ${hm12(r.time_out)}` : ""}
                    </span>
                  )}
                </p>
              </div>
              <span className={cx("shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold", STATUS[r.status].cls)}>
                {STATUS[r.status].label}
              </span>
            </div>
            <p className="mt-2 text-[14px] leading-relaxed text-slate-700">{r.reason}</p>
            {r.review_note && (
              <p className="mt-2 rounded-xl bg-navy-50 px-3 py-2 text-[13px] text-navy-800">
                {r.reviewer ?? "Admin"}: {r.review_note}
              </p>
            )}
            {r.status === "pending" && (
              <div className="mt-3 flex justify-end">
                <Button size="sm" variant="ghost" onClick={() => withdraw(r.id)}>
                  Withdraw
                </Button>
              </div>
            )}
          </article>
        ))}
      </div>
      <NewRequestSheet
        initial={form}
        onClose={() => setForm(null)}
        onSaved={() => {
          setForm(null);
          toast("Request sent to the admin");
          load();
        }}
      />
    </div>
  );
}

function NewRequestSheet({
  initial,
  onClose,
  onSaved,
}: {
  initial: { type: RequestType; date: string } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<RequestType>("cuti");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [timeIn, setTimeIn] = useState("");
  const [timeOut, setTimeOut] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!initial) return;
    setType(initial.type);
    setFrom(initial.date);
    setTo(initial.date);
    setTimeIn("");
    setTimeOut("");
    setReason("");
    setError(null);
  }, [initial]);

  const correction = type === "pembetulan";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/requests", {
        body: {
          type,
          dateFrom: from,
          dateTo: correction ? from : to || from,
          timeIn: correction ? timeIn || null : null,
          timeOut: correction ? timeOut || null : null,
          reason,
        },
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={!!initial} onClose={onClose} title="New request">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold text-navy-900">Type</legend>
          <div className="grid grid-cols-2 gap-2">
            {REQUEST_TYPE_KEYS.map((k) => (
              <label
                key={k}
                className={cx(
                  "cursor-pointer rounded-xl px-3 py-2.5 ring-1 transition-colors",
                  type === k ? "bg-navy-800 text-white ring-navy-800" : "bg-white text-navy-900 ring-navy-200 hover:bg-navy-50",
                )}
              >
                <input type="radio" name="type" value={k} checked={type === k} onChange={() => setType(k)} className="sr-only" />
                <span className="block text-[13.5px] font-semibold">{REQUEST_TYPES[k].en}</span>
                <span className={cx("block text-[11.5px] leading-snug", type === k ? "text-navy-200" : "text-slate-500")}>
                  {REQUEST_TYPES[k].hint}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {correction ? (
          <>
            <Field label="Date">
              {(id) => <Input id={id} type="date" value={from} max={mytDate()} onChange={(e) => setFrom(e.target.value)} required />}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Correct clock in" hint="Leave empty to keep">
                {(id) => <Input id={id} type="time" value={timeIn} onChange={(e) => setTimeIn(e.target.value)} />}
              </Field>
              <Field label="Correct clock out" hint="Leave empty to keep">
                {(id) => <Input id={id} type="time" value={timeOut} onChange={(e) => setTimeOut(e.target.value)} />}
              </Field>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="From">
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  value={from}
                  onChange={(e) => {
                    setFrom(e.target.value);
                    if (!to || to < e.target.value) setTo(e.target.value);
                  }}
                  required
                />
              )}
            </Field>
            <Field label="To">
              {(id) => <Input id={id} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} required />}
            </Field>
          </div>
        )}

        <Field label="Reason" hint={type === "kursus" || type === "tugas_luar" ? "Prints on your record, e.g. Bengkel AI di SMK Likas." : undefined}>
          {(id) => (
            <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={500} placeholder="Short and clear" />
          )}
        </Field>
        {error && <p className="rounded-xl bg-danger-50 px-3.5 py-2.5 text-[13.5px] font-medium text-danger-700">{error}</p>}
        <Button type="submit" size="lg" loading={busy}>
          Send request
        </Button>
      </form>
    </Sheet>
  );
}
