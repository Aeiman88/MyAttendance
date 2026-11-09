"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, Pencil, UserPlus, Users } from "lucide-react";
import { PageHead, Panel } from "@/components/admin-shell";
import { Avatar, Button, EmptyState, Field, Input, Select, Sheet, Spinner, cx } from "@/components/ui";
import { useToast } from "@/components/toast";
import { useUser } from "@/components/user-context";
import { api, errorMessage } from "@/lib/api";
import type { Schedule } from "@/lib/rules";
import { dmy, mytDate } from "@/lib/time";

type StaffItem = {
  id: number;
  staff_no: string;
  full_name: string;
  position: string;
  email: string;
  phone: string;
  role: "staff" | "admin";
  schedule_id: number | null;
  schedule_code: string | null;
  schedule_name: string | null;
  active: boolean;
  must_change_password: boolean;
  last_seen: string | null;
  in_today: number;
};

type Form = {
  id?: number;
  fullName: string;
  staffNo: string;
  position: string;
  email: string;
  phone: string;
  role: "staff" | "admin";
  scheduleId: string;
  active: boolean;
};

const empty: Form = { fullName: "", staffNo: "", position: "", email: "", phone: "", role: "staff", scheduleId: "", active: true };

export default function StaffAdmin() {
  const me = useUser();
  const toast = useToast();
  const [staff, setStaff] = useState<StaffItem[] | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ name: string; staffNo: string; password: string } | null>(null);
  const [confirmReset, setConfirmReset] = useState<StaffItem | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, settings] = await Promise.all([
        api<{ staff: StaffItem[] }>("/api/admin/staff"),
        api<{ schedules: Schedule[] }>("/api/admin/settings"),
      ]);
      setStaff(s.staff);
      setSchedules(settings.schedules);
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  function edit(s: StaffItem) {
    setFormError(null);
    setForm({
      id: s.id,
      fullName: s.full_name,
      staffNo: s.staff_no,
      position: s.position,
      email: s.email,
      phone: s.phone,
      role: s.role,
      scheduleId: s.schedule_id ? String(s.schedule_id) : "",
      active: s.active,
    });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setFormError(null);
    const payload = {
      fullName: form.fullName,
      staffNo: form.staffNo,
      position: form.position,
      email: form.email,
      phone: form.phone,
      role: form.role,
      scheduleId: form.scheduleId ? Number(form.scheduleId) : null,
      ...(form.id ? { active: form.active } : {}),
    };
    try {
      if (form.id) {
        await api(`/api/admin/staff/${form.id}`, { method: "PATCH", body: payload });
        toast("Changes saved");
      } else {
        const res = await api<{ tempPassword: string }>("/api/admin/staff", { body: payload });
        setSecret({ name: form.fullName, staffNo: form.staffNo, password: res.tempPassword });
      }
      setForm(null);
      load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function reset(s: StaffItem) {
    try {
      const res = await api<{ tempPassword: string }>(`/api/admin/staff/${s.id}/reset-password`, { method: "POST" });
      setConfirmReset(null);
      setSecret({ name: s.full_name, staffNo: s.staff_no, password: res.tempPassword });
      load();
    } catch (e) {
      toast(errorMessage(e), "error");
    }
  }

  const today = mytDate();

  return (
    <div>
      <PageHead
        title="Staff"
        sub="Everyone who clocks in with MyAttendance."
        actions={
          <Button onClick={() => (setFormError(null), setForm({ ...empty }))}>
            <UserPlus className="size-4" /> Add staff
          </Button>
        }
      />
      <Panel>
        {!staff ? (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        ) : staff.length === 0 ? (
          <EmptyState icon={<Users className="size-6" />} title="No staff yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[14px]">
              <thead className="text-[12.5px] text-slate-500">
                <tr className="border-b border-navy-50">
                  <th className="px-4 py-2.5 font-semibold">Name</th>
                  <th className="px-3 py-2.5 font-semibold">Role</th>
                  <th className="px-3 py-2.5 font-semibold">Working hours</th>
                  <th className="px-3 py-2.5 font-semibold">Last clock-in</th>
                  <th className="px-3 py-2.5 font-semibold">Account</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className={cx("border-b border-navy-50 last:border-0", !s.active && "opacity-55")}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={s.full_name} className="size-9" />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-navy-900">{s.full_name}</p>
                          <p className="text-[12.5px] text-slate-500">
                            {s.staff_no}
                            {s.position ? `, ${s.position}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cx("rounded-full px-2 py-0.5 text-[12px] font-semibold", s.role === "admin" ? "bg-gold-100 text-gold-700" : "bg-navy-50 text-navy-700")}>
                        {s.role === "admin" ? "Admin" : "Staff"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-navy-800">{s.schedule_code ? `${s.schedule_code}, ${s.schedule_name}` : "Default"}</td>
                    <td className="px-3 py-3 text-navy-800 tabular">
                      {s.in_today ? <span className="font-semibold text-teal-700">Today</span> : s.last_seen ? dmy(s.last_seen) : <span className="text-slate-400">Never</span>}
                    </td>
                    <td className="px-3 py-3 text-[13px]">
                      {!s.active ? (
                        <span className="text-slate-500">Switched off</span>
                      ) : s.must_change_password ? (
                        <span className="text-gold-700">Temporary password</span>
                      ) : (
                        <span className="text-teal-700">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => edit(s)} aria-label={`Edit ${s.full_name}`}>
                          <Pencil className="size-4" /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirmReset(s)} aria-label={`Reset password for ${s.full_name}`}>
                          <KeyRound className="size-4" /> Reset
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <p className="mt-3 text-[13px] text-slate-500">Last clock-in dates up to {dmy(today)}. Switched-off accounts keep their records but can&apos;t log in.</p>

      <Sheet open={!!form} onClose={() => setForm(null)} title={form?.id ? "Edit staff" : "Add staff"}>
        {form && (
          <form onSubmit={save} className="flex flex-col gap-4">
            <Field label="Full name" hint="Printed in the Nama Pekerja column.">
              {(id) => <Input id={id} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required minLength={2} />}
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Staff number" hint="Used to log in.">
                {(id) => <Input id={id} value={form.staffNo} onChange={(e) => setForm({ ...form, staffNo: e.target.value })} required minLength={2} />}
              </Field>
              <Field label="Position">
                {(id) => <Input id={id} value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="Jurulatih AI" />}
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Phone">
                {(id) => <Input id={id} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />}
              </Field>
              <Field label="Email">
                {(id) => <Input id={id} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Working hours">
                {(id) => (
                  <Select id={id} value={form.scheduleId} onChange={(e) => setForm({ ...form, scheduleId: e.target.value })}>
                    <option value="">Default slot</option>
                    {schedules.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.code}, {s.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Role">
                {(id) => (
                  <Select id={id} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Form["role"] })}>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                  </Select>
                )}
              </Field>
            </div>
            {form.id && form.id !== me.id && (
              <label className="flex items-center gap-3 rounded-xl bg-navy-50 px-3.5 py-3 text-[14px] font-medium text-navy-900">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="size-5 accent-navy-800" />
                Account is active (can log in and clock in)
              </label>
            )}
            {formError && <p className="rounded-xl bg-danger-50 px-3.5 py-2.5 text-[13.5px] font-medium text-danger-700">{formError}</p>}
            <Button type="submit" size="lg" loading={saving}>
              {form.id ? "Save changes" : "Add staff and create password"}
            </Button>
          </form>
        )}
      </Sheet>

      <Sheet open={!!confirmReset} onClose={() => setConfirmReset(null)} title="Reset password?">
        <p className="text-[15px] leading-relaxed text-slate-600">
          {confirmReset?.full_name} gets a new temporary password and is signed out on all devices. They choose their own password when they next log in.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={() => setConfirmReset(null)}>
            Cancel
          </Button>
          <Button onClick={() => confirmReset && reset(confirmReset)} data-autofocus>
            Reset password
          </Button>
        </div>
      </Sheet>

      <Sheet open={!!secret} onClose={() => setSecret(null)} title="Temporary password">
        {secret && (
          <div className="flex flex-col gap-4">
            <p className="text-[14.5px] leading-relaxed text-slate-600">
              Give these details to <span className="font-semibold text-navy-900">{secret.name}</span>, with the app link. The password is shown only once.
            </p>
            <div className="rounded-2xl bg-navy-800 p-4 text-white">
              <p className="text-[12.5px] text-navy-200">Staff number</p>
              <p className="text-[17px] font-bold">{secret.staffNo}</p>
              <p className="mt-2 text-[12.5px] text-navy-200">Temporary password</p>
              <p className="text-[22px] font-bold tracking-wide tabular">{secret.password}</p>
            </div>
            <Button
              variant="secondary"
              onClick={async () => {
                const text = `MyAttendance\nGet the app: ${window.location.origin}/app\nServer: ${window.location.origin}\nStaff number: ${secret.staffNo}\nTemporary password: ${secret.password}`;
                try {
                  await navigator.clipboard.writeText(text);
                  toast("Copied");
                } catch {
                  toast("Couldn't copy. Write it down instead.", "error");
                }
              }}
            >
              <Copy className="size-4" /> Copy login details
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
