"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, FilePenLine, X } from "lucide-react";
import { PageHead } from "@/components/admin-shell";
import { Avatar, Button, EmptyState, Field, Segmented, Sheet, Spinner, Textarea, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { api, errorMessage } from "@/lib/api";
import { REQUEST_TYPES, type RequestType } from "@/lib/rules";
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
  full_name: string;
  staff_no: string;
};

const STATUS_CLS: Record<Req["status"], string> = {
  pending: "bg-gold-100 text-gold-700",
  approved: "bg-teal-100 text-teal-700",
  rejected: "bg-danger-100 text-danger-700",
  cancelled: "bg-slate-100 text-slate-500",
};
const STATUS_LABEL: Record<Req["status"], string> = { pending: "Pending", approved: "Approved", rejected: "Rejected", cancelled: "Withdrawn" };

export default function RequestsAdmin() {
  const toast = useToast();
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [items, setItems] = useState<Req[] | null>(null);
  const [decide, setDecide] = useState<{ req: Req; decision: "approved" | "rejected" } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems((await api<{ requests: Req[] }>(`/api/admin/requests?status=${tab}`)).requests);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }, [tab, toast]);

  useEffect(() => {
    setItems(null);
    load();
  }, [load]);

  async function submit() {
    if (!decide) return;
    setBusy(true);
    try {
      await api(`/api/admin/requests/${decide.req.id}`, { method: "PATCH", body: { decision: decide.decision, note: note || undefined } });
      toast(decide.decision === "approved" ? "Request approved" : "Request rejected");
      setDecide(null);
      setNote("");
      load();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHead
        title="Requests"
        sub="Approved leave and duty fill Perkara Khas. Approved time corrections update the record."
        actions={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "pending", label: "Waiting" },
              { value: "all", label: "All" },
            ]}
          />
        }
      />
      {!items ? (
        <div className="grid place-items-center py-16">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl bg-white ring-1 ring-navy-100">
          <EmptyState icon={<FilePenLine className="size-6" />} title={tab === "pending" ? "Nothing waiting" : "No requests yet"}>
            {tab === "pending" ? "New leave and correction requests from staff appear here." : undefined}
          </EmptyState>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((r) => (
            <article key={r.id} className="flex flex-col rounded-2xl bg-white p-4 ring-1 ring-navy-100">
              <div className="flex items-start gap-3">
                <Avatar name={r.full_name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold text-navy-900">{r.full_name}</p>
                  <p className="text-[12.5px] text-slate-500">
                    {r.staff_no}, sent {dmy(mytDate(new Date(r.created_at)))}
                  </p>
                </div>
                <span className={cx("rounded-full px-2.5 py-1 text-[12px] font-semibold", STATUS_CLS[r.status])}>{STATUS_LABEL[r.status]}</span>
              </div>
              <div className="mt-3 rounded-xl bg-navy-50 px-3.5 py-3">
                <p className="text-[14.5px] font-semibold text-navy-900">
                  {REQUEST_TYPES[r.type].en} <span className="font-normal text-slate-500">({REQUEST_TYPES[r.type].ms})</span>
                </p>
                <p className="text-[13.5px] font-medium text-navy-700 tabular">
                  {r.date_from === r.date_to ? dmy(r.date_from) : `${dmy(r.date_from)} to ${dmy(r.date_to)}`}
                  {r.time_in ? `, clock in ${hm12(r.time_in)}` : ""}
                  {r.time_out ? `, clock out ${hm12(r.time_out)}` : ""}
                </p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-slate-700">{r.reason}</p>
              </div>
              {r.review_note && (
                <p className="mt-2 text-[13px] text-slate-600">
                  {r.reviewer ?? "Admin"}: {r.review_note}
                </p>
              )}
              {r.status === "pending" && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => (setNote(""), setDecide({ req: r, decision: "rejected" }))}>
                    <X className="size-4" /> Reject
                  </Button>
                  <Button variant="teal" onClick={() => (setNote(""), setDecide({ req: r, decision: "approved" }))}>
                    <Check className="size-4" /> Approve
                  </Button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      <Sheet open={!!decide} onClose={() => setDecide(null)} title={decide?.decision === "approved" ? "Approve request" : "Reject request"}>
        {decide && (
          <div className="flex flex-col gap-4">
            <p className="text-[14.5px] leading-relaxed text-slate-600">
              {decide.decision === "approved"
                ? decide.req.type === "pembetulan"
                  ? `This writes the corrected time${decide.req.time_in && decide.req.time_out ? "s" : ""} into ${decide.req.full_name}'s record for ${dmy(decide.req.date_from)}.`
                  : `${REQUEST_TYPES[decide.req.type].ms} will show in Perkara Khas for these dates.`
                : `${decide.req.full_name} will see that this request was not approved.`}
            </p>
            <Field label="Note to staff (optional)">
              {(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className="min-h-20" />}
            </Field>
            <Button variant={decide.decision === "approved" ? "teal" : "danger"} size="lg" loading={busy} onClick={submit}>
              {decide.decision === "approved" ? "Approve" : "Reject"}
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
