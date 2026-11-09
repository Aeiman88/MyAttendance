"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, Download, KeyRound, LogOut, PenLine, Printer, ShieldCheck, Smartphone } from "lucide-react";
import { TopBar } from "@/components/staff-shell";
import { Avatar, Button, Sheet, Spinner } from "@/components/ui";
import { SignaturePad } from "@/components/signature-pad";
import { useToast } from "@/components/toast";
import { api, errorMessage } from "@/lib/api";
import type { Schedule } from "@/lib/rules";
import { hm12 } from "@/lib/time";

type Me = {
  user: {
    id: number;
    staffNo: string;
    name: string;
    position: string;
    role: "staff" | "admin";
    email: string;
    phone: string;
    signature: string | null;
  };
  schedule: Schedule | null;
  orgName: string;
};

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function ProfilePage() {
  const toast = useToast();
  const [me, setMe] = useState<Me | null>(null);
  const [signing, setSigning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [install, setInstall] = useState<InstallPrompt | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [ios, setIos] = useState(false);

  const load = () => api<Me>("/api/me").then(setMe).catch((e) => toast(errorMessage(e), "error"));
  useEffect(() => {
    load();
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    setStandalone(window.matchMedia("(display-mode: standalone)").matches);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveSignature(dataUrl: string | null) {
    setBusy(true);
    try {
      await api("/api/me/signature", { method: "PUT", body: { signature: dataUrl } });
      toast(dataUrl ? "Signature saved" : "Signature removed");
      setSigning(false);
      await load();
    } catch (e) {
      toast(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.assign("/login");
  }

  if (!me) {
    return (
      <div>
        <TopBar title="Profile" />
        <div className="grid place-items-center py-24">
          <Spinner />
        </div>
      </div>
    );
  }
  const u = me.user;

  return (
    <div>
      <TopBar title="Profile" />
      <div className="flex flex-col gap-3 px-4">
        <section className="flex items-center gap-4 rounded-[22px] bg-navy-800 p-4 text-white">
          <Avatar name={u.name} className="size-14 bg-white/12 text-lg text-white" />
          <div className="min-w-0">
            <p className="truncate text-[17px] font-bold">{u.name}</p>
            <p className="text-[13.5px] text-navy-200">
              {u.staffNo}
              {u.position ? `, ${u.position}` : ""}
            </p>
            <p className="mt-1 text-[12.5px] text-navy-200">{me.orgName}</p>
          </div>
          {u.role === "admin" && (
            <span className="ml-auto self-start rounded-full bg-gold-500 px-2.5 py-1 text-[11.5px] font-bold text-navy-950">Admin</span>
          )}
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-navy-100">
          <p className="text-[13px] font-semibold text-navy-600">Working hours</p>
          <p className="mt-0.5 text-[16px] font-bold text-navy-900">
            {me.schedule ? `${me.schedule.code}, ${hm12(me.schedule.start_time)} – ${hm12(me.schedule.end_time)}` : "Not set"}
          </p>
          <p className="text-[12.5px] text-slate-500">Set by the admin. Clocking in after the start time counts as late.</p>
        </section>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-navy-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[15px] font-bold text-navy-900">My signature</p>
              <p className="text-[12.5px] text-slate-500">Printed in the T. Tangan column when you choose to.</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => setSigning(true)}>
              <PenLine className="size-4" /> {u.signature ? "Redo" : "Draw"}
            </Button>
          </div>
          <div className="mt-3 grid h-24 place-items-center rounded-xl bg-navy-50/60 ring-1 ring-navy-100">
            {u.signature ? (
              <img src={u.signature} alt="Your saved signature" className="max-h-20 max-w-[80%] object-contain" />
            ) : (
              <span className="text-[13px] text-slate-400">No signature saved</span>
            )}
          </div>
          {u.signature && (
            <button type="button" onClick={() => saveSignature(null)} className="mt-2 text-[13px] font-semibold text-danger-600">
              Remove signature
            </button>
          )}
        </section>

        <nav className="overflow-hidden rounded-2xl bg-white ring-1 ring-navy-100">
          {u.role === "admin" && <Row href="/admin" icon={<ShieldCheck className="size-5" />} label="Admin panel" />}
          <Row href="/records" icon={<Printer className="size-5" />} label="Print my attendance record" />
          <Row href="/change-password" icon={<KeyRound className="size-5" />} label="Change password" />
        </nav>

        {!standalone && (
          <section className="flex items-start gap-3 rounded-2xl bg-iris-50 p-4 ring-1 ring-iris-100">
            <Smartphone className="mt-0.5 size-5 shrink-0 text-iris-600" />
            <div className="flex-1">
              <p className="text-[14.5px] font-bold text-navy-900">Install on your phone</p>
              <p className="text-[12.5px] leading-snug text-slate-600">
                {install
                  ? "Adds MyAttendance to your home screen so it opens like an app."
                  : ios
                    ? "In Safari, tap Share, then Add to Home Screen."
                    : "In Chrome, open the menu and choose Add to Home screen or Install app."}
              </p>
              {install && (
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={async () => {
                    await install.prompt();
                    setInstall(null);
                  }}
                >
                  <Download className="size-4" /> Install app
                </Button>
              )}
            </div>
          </section>
        )}

        <Button variant="secondary" onClick={logout} className="mt-1">
          <LogOut className="size-4" /> Log out
        </Button>
      </div>

      <Sheet open={signing} onClose={() => setSigning(false)} title="Draw your signature">
        <SignaturePad onSave={(d) => saveSignature(d)} busy={busy} />
      </Sheet>
    </div>
  );
}

function Row({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 border-b border-navy-50 px-4 py-3.5 last:border-0 hover:bg-navy-50/60">
      <span className="text-navy-600">{icon}</span>
      <span className="flex-1 text-[15px] font-semibold text-navy-900">{label}</span>
      <ChevronRight className="size-4 text-slate-400" />
    </Link>
  );
}
