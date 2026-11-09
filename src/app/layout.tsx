import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { ToastProvider } from "@/components/toast";
import { ServiceWorker } from "@/components/service-worker";

export const metadata: Metadata = {
  title: { default: "MyAttendance", template: "%s | MyAttendance" },
  description: "DAICOE staff attendance: clock in and out with GPS, view records and print the attendance form.",
  applicationName: "MyAttendance",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "MyAttendance", statusBarStyle: "default" },
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192" }],
    apple: "/icons/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#102a5e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
