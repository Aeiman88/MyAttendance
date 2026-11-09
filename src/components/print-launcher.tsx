"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileSignature, Printer } from "lucide-react";
import { Field, Input, Segmented, Select, buttonClass, cx } from "./ui";
import { currentMonth, monthLabel, monthRange, mytDate, shiftMonth } from "@/lib/time";

type Period = "this" | "last" | "month" | "range";

/** Picks a period and opens the printable form. Admins can also pick a staff member or everyone. */
export function PrintLauncher({
  hasSignature,
  staffOptions,
  defaultStaff,
}: {
  hasSignature: boolean;
  staffOptions?: Array<{ id: number; name: string; staffNo: string }>;
  defaultStaff?: string;
}) {
  const [period, setPeriod] = useState<Period>("this");
  const [month, setMonth] = useState(shiftMonth(currentMonth(), -1));
  const [from, setFrom] = useState(monthRange(currentMonth()).from);
  const [to, setTo] = useState(mytDate());
  const [sig, setSig] = useState(hasSignature);
  const [staff, setStaff] = useState(defaultStaff ?? "me");

  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("month");
    if (m && /^\d{4}-\d{2}$/.test(m)) {
      if (m === currentMonth()) setPeriod("this");
      else if (m === shiftMonth(currentMonth(), -1)) setPeriod("last");
      else {
        setPeriod("month");
        setMonth(m);
      }
    }
  }, []);

  const q = new URLSearchParams();
  if (period === "this") q.set("month", currentMonth());
  if (period === "last") q.set("month", shiftMonth(currentMonth(), -1));
  if (period === "month") q.set("month", month);
  if (period === "range") {
    q.set("from", from);
    q.set("to", to);
  }
  if (sig) q.set("sig", "1");
  if (staffOptions && staff !== "me") q.set("staff", staff);
  const href = `/print?${q.toString()}`;

  return (
    <div className="flex flex-col gap-4">
      <FormPreview />
      {staffOptions && (
        <Field label="Whose record">
          {(id) => (
            <Select id={id} value={staff} onChange={(e) => setStaff(e.target.value)}>
              <option value="me">My own record</option>
              <option value="all">Everyone (one after another)</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name} ({s.staffNo})
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      <div>
        <p className="mb-2 text-[13px] font-semibold text-navy-900">Period</p>
        <Segmented<Period>
          value={period}
          onChange={setPeriod}
          className="w-full [&>button]:flex-1 [&>button]:whitespace-nowrap [&>button]:px-1.5"
          options={[
            { value: "this", label: "This month" },
            { value: "last", label: "Last month" },
            { value: "month", label: "Month" },
            { value: "range", label: "Dates" },
          ]}
        />
      </div>
      {period === "month" && (
        <Field label="Month">{(id) => <Input id={id} type="month" value={month} max={currentMonth()} onChange={(e) => setMonth(e.target.value)} />}</Field>
      )}
      {period === "range" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">{(id) => <Input id={id} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
          <Field label="To">{(id) => <Input id={id} type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />}</Field>
        </div>
      )}
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-3.5 ring-1 ring-navy-100">
        <input
          type="checkbox"
          checked={sig}
          onChange={(e) => setSig(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-navy-800"
        />
        <span>
          <span className="block text-[14.5px] font-semibold text-navy-900">Print signatures in T. Tangan</span>
          <span className="block text-[12.5px] leading-snug text-slate-500">
            Uses the signature saved in each person&apos;s profile, on days they attended. Leave off to sign by hand.
            {!hasSignature && !staffOptions && (
              <>
                {" "}
                <Link href="/profile" className="font-semibold text-iris-600">
                  Add your signature
                </Link>
              </>
            )}
          </span>
        </span>
      </label>
      <Link href={href} className={buttonClass("primary", "lg", "w-full")}>
        <Printer className="size-5" /> Open print view
      </Link>
      <p className="text-center text-[12.5px] text-slate-500">
        {period === "this" || period === "last" || period === "month"
          ? monthLabel(period === "this" ? currentMonth() : period === "last" ? shiftMonth(currentMonth(), -1) : month)
          : `${from} to ${to}`}
        , A4 landscape, two weeks per page. Choose Save as PDF in the print dialog to keep a copy.
      </p>
    </div>
  );
}

function FormPreview() {
  const days = ["Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu", "Ahad"];
  return (
    <figure className="rounded-2xl bg-white p-3 ring-1 ring-navy-100">
      <div className="rounded-lg border border-slate-300 bg-white p-2 font-serif text-[6.5px] italic leading-none text-slate-700">
        <p className="mb-1 text-center text-[7.5px] font-bold">Rekod Kedatangan Pekerja Lembaga Pengurusan Sekolah Tinggi Kota Kinabalu</p>
        <div className="grid grid-cols-[1.2fr_0.7fr_2fr_1.5fr_1.5fr_1.1fr_1.8fr] border-l border-t border-slate-400">
          {["Tarikh", "Hari", "Nama Pekerja", "Masa Datang", "Masa Balik", "T. Tangan", "Perkara Khas"].map((h) => (
            <span key={h} className="border-b border-r border-slate-400 px-0.5 py-[3px] text-center">
              {h}
            </span>
          ))}
          {days.map((d, i) => (
            <Row key={d} day={d} filled={i < 5} />
          ))}
        </div>
      </div>
      <figcaption className="mt-2 flex items-center gap-2 text-[12.5px] text-slate-600">
        <FileSignature className="size-4 text-navy-600" /> Same layout as the LPS paper form, filled from your records.
      </figcaption>
    </figure>
  );
}

function Row({ day, filled }: { day: string; filled: boolean }) {
  const c = "border-b border-r border-slate-400 px-0.5 py-[3px] text-center not-italic";
  return (
    <>
      <span className={c}>{filled ? "02/11" : ""}</span>
      <span className={cx(c, "italic")}>{day}</span>
      <span className={c}>{filled ? <span className="mx-auto block h-[3px] w-3/4 rounded bg-slate-300" /> : ""}</span>
      <span className={c}>{filled ? "8:02 pagi" : ""}</span>
      <span className={c}>{filled ? "5:10 petang" : ""}</span>
      <span className={c}>{filled ? <span className="mx-auto block h-[3px] w-1/2 rounded bg-navy-300" /> : ""}</span>
      <span className={c}></span>
    </>
  );
}
