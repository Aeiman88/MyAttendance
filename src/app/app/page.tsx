import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { Download, MapPin, Smartphone } from "lucide-react";
import { AuthFrame } from "@/components/auth-frame";
import { getDb, getSettings } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Get the app" };

/** Public page staff open to install the MyAttendance phone app. */
export default async function GetTheAppPage() {
  const db = await getDb();
  const settings = await getSettings(db);
  const download = settings.app_download_url?.trim() || "";
  const webClockIn = settings.web_clock_in === "1";

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto")?.split(",")[0] ?? (host.startsWith("localhost") ? "http" : "https");
  const pageUrl = `${proto}://${host}/app`;
  const serverUrl = `${proto}://${host}`;
  const qrTarget = download || pageUrl;
  const qr = await QRCode.toString(qrTarget, { type: "svg", margin: 1, color: { dark: "#0a1a40", light: "#ffffff" } });

  return (
    <AuthFrame
      title="Get the MyAttendance app"
      intro="Staff clock in and out with the MyAttendance app on their phone. Install it once, then log in with your staff number."
    >
      <div className="flex flex-col gap-5">
        {download ? (
          <a
            href={download}
            className="inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-navy-800 px-5 text-base font-semibold text-white hover:bg-navy-700"
          >
            <Download className="size-5" /> Download for Android
          </a>
        ) : (
          <p className="rounded-xl bg-gold-50 px-4 py-3 text-[14px] leading-relaxed text-navy-900 ring-1 ring-gold-100">
            The download link hasn&apos;t been added yet. Ask the DAICOE admin.
          </p>
        )}

        <figure className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-navy-100">
          <div className="size-28 shrink-0 [&_svg]:size-full" dangerouslySetInnerHTML={{ __html: qr }} />
          <figcaption className="text-[13.5px] leading-relaxed text-slate-600">
            On a computer? Scan this with your phone&apos;s camera to {download ? "download the app" : "open this page"}.
          </figcaption>
        </figure>

        <ol className="flex flex-col gap-3">
          <Step n={1} icon={<Download className="size-4" />} title="Install">
            Open the downloaded file. If Android asks, allow installing apps from your browser, then tap Install.
          </Step>
          <Step n={2} icon={<Smartphone className="size-4" />} title="Log in">
            Open MyAttendance and log in with the staff number and temporary password from the admin. The server address is{" "}
            <span className="font-semibold text-navy-900">{serverUrl}</span> if the app asks for it.
          </Step>
          <Step n={3} icon={<MapPin className="size-4" />} title="Allow location">
            Choose &quot;While using the app&quot; and keep Precise location on. The app uses your location only while its Clock screen is open, never in the background.
          </Step>
        </ol>

        <p className="text-[13px] leading-relaxed text-slate-500">
          Using an iPhone?{" "}
          {webClockIn ? (
            <>
              Until the iPhone app is ready,{" "}
              <Link href="/login" className="font-semibold text-iris-600 hover:underline">
                clock in on the website
              </Link>
              .
            </>
          ) : (
            "Ask the admin how to clock in until the iPhone app is ready."
          )}
        </p>
      </div>
    </AuthFrame>
  );
}

function Step({ n, icon, title, children }: { n: number; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-navy-800 text-[13px] font-bold text-white" aria-hidden>
        {n}
      </span>
      <div>
        <p className="flex items-center gap-1.5 text-[14.5px] font-semibold text-navy-900">
          <span className="text-teal-600">{icon}</span>
          {title}
        </p>
        <p className="text-[13.5px] leading-relaxed text-slate-600">{children}</p>
      </div>
    </li>
  );
}
