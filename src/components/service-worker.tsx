"use client";

import { useEffect } from "react";

/** Registers the service worker so phones can install MyAttendance like an app. */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* installing is optional; the app works without it */
    });
  }, []);
  return null;
}
