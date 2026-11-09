"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button, Field, Input } from "./ui";
import { ApiError, api, errorMessage } from "@/lib/api";

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="pr-11" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-400 hover:text-navy-700"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
      </button>
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-danger-50 px-3.5 py-2.5 text-[13.5px] font-medium text-danger-700 ring-1 ring-danger-100">
      {message}
    </p>
  );
}

export function LoginForm() {
  const [staffNo, setStaffNo] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appOnly, setAppOnly] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setAppOnly(false);
    try {
      const res = await api<{ mustChangePassword: boolean; role: string }>("/api/auth/login", { body: { staffNo, password } });
      window.location.assign(res.mustChangePassword ? "/change-password" : res.role === "admin" ? "/admin" : "/attendance");
    } catch (err) {
      if (err instanceof ApiError && err.code === "APP_ONLY") setAppOnly(true);
      else setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Staff number">
        {(id) => (
          <Input
            id={id}
            value={staffNo}
            onChange={(e) => setStaffNo(e.target.value)}
            autoComplete="username"
            autoCapitalize="characters"
            placeholder="e.g. DAICOE-01"
            required
          />
        )}
      </Field>
      <Field label="Password">
        {(id) => (
          <PasswordInput id={id} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        )}
      </Field>
      <FormError message={error} />
      {appOnly && (
        <div role="alert" className="rounded-xl bg-iris-50 px-3.5 py-3 text-[13.5px] leading-relaxed text-navy-900 ring-1 ring-iris-100">
          <p className="font-semibold">Use the MyAttendance app on your phone</p>
          <p className="mt-0.5 text-slate-600">Your staff number and password are right. Staff clock in with the phone app; this website is for admins.</p>
          <Link href="/app" className="mt-2 inline-block font-semibold text-iris-600 hover:underline">
            Get the app
          </Link>
        </div>
      )}
      <Button type="submit" size="lg" loading={busy} className="mt-1">
        Log in
      </Button>
      <p className="text-center text-[13px] text-slate-500">Forgot your password? Ask the DAICOE admin to reset it.</p>
    </form>
  );
}

export function SetupForm() {
  const [f, setF] = useState({ fullName: "", staffNo: "", position: "", password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.password !== f.confirm) return setError("The two passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/setup", { body: { fullName: f.fullName, staffNo: f.staffNo, position: f.position, password: f.password } });
      window.location.assign("/admin");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Full name" hint="As it should appear on the printed attendance record.">
        {(id) => <Input id={id} value={f.fullName} onChange={set("fullName")} autoComplete="name" required minLength={2} />}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Staff number">
          {(id) => <Input id={id} value={f.staffNo} onChange={set("staffNo")} placeholder="DAICOE-01" required minLength={2} />}
        </Field>
        <Field label="Position">
          {(id) => <Input id={id} value={f.position} onChange={set("position")} placeholder="Pengurus" />}
        </Field>
      </div>
      <Field label="Password" hint="At least 8 characters.">
        {(id) => <PasswordInput id={id} value={f.password} onChange={set("password")} autoComplete="new-password" required minLength={8} />}
      </Field>
      <Field label="Confirm password">
        {(id) => <PasswordInput id={id} value={f.confirm} onChange={set("confirm")} autoComplete="new-password" required minLength={8} />}
      </Field>
      <FormError message={error} />
      <Button type="submit" size="lg" loading={busy} className="mt-1">
        Create admin account
      </Button>
    </form>
  );
}

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const [f, setF] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (f.next !== f.confirm) return setError("The two new passwords don't match.");
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/password", { body: { currentPassword: f.current, newPassword: f.next } });
      window.location.assign("/");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label={forced ? "Temporary password" : "Current password"}>
        {(id) => <PasswordInput id={id} value={f.current} onChange={set("current")} autoComplete="current-password" required />}
      </Field>
      <Field label="New password" hint="At least 8 characters.">
        {(id) => <PasswordInput id={id} value={f.next} onChange={set("next")} autoComplete="new-password" required minLength={8} />}
      </Field>
      <Field label="Confirm new password">
        {(id) => <PasswordInput id={id} value={f.confirm} onChange={set("confirm")} autoComplete="new-password" required minLength={8} />}
      </Field>
      <FormError message={error} />
      <Button type="submit" size="lg" loading={busy} className="mt-1">
        Save new password
      </Button>
      {!forced && (
        <Link href="/" className="text-center text-[14px] font-semibold text-navy-700">
          Cancel
        </Link>
      )}
    </form>
  );
}
