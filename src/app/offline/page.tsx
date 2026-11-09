import type { Metadata } from "next";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-mist px-6 text-center">
      <div className="max-w-xs">
        <img src="/icons/icon.svg" alt="" className="mx-auto size-16" />
        <h1 className="mt-5 text-xl font-bold text-navy-900">You&apos;re offline</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-600">
          Clocking in needs the internet, because the time is taken from the server. Connect to Wi-Fi or mobile data, then try again.
        </p>
        <a href="/attendance" className="mt-6 inline-flex h-11 items-center rounded-xl bg-navy-800 px-5 font-semibold text-white">
          Try again
        </a>
      </div>
    </main>
  );
}
