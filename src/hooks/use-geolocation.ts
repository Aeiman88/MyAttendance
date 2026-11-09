"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Fix = { lat: number; lng: number; accuracy: number; at: number };
export type GeoStatus = "locating" | "active" | "denied" | "unavailable" | "insecure" | "unsupported";

/**
 * Watches the device position. `fresh()` asks for a new fix right before clocking,
 * falling back to the latest watched fix if it is under 30 seconds old.
 */
export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>("locating");
  const [fix, setFix] = useState<Fix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef<Fix | null>(null);
  const [nonce, setNonce] = useState(0);

  const accept = useCallback((p: GeolocationPosition) => {
    const f = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, at: Date.now() };
    latest.current = f;
    setFix(f);
    setStatus("active");
    setError(null);
  }, []);

  const reject = useCallback((e: GeolocationPositionError) => {
    if (e.code === e.PERMISSION_DENIED) {
      setStatus("denied");
      setError("Location access is blocked. Allow location for this site in your browser settings, then tap Retry.");
    } else if (!latest.current) {
      setStatus("unavailable");
      setError(
        e.code === e.TIMEOUT
          ? "Still looking for your location. Turn on GPS / Location services, then tap Retry."
          : "Your device could not get a location. Turn on GPS / Location services, then tap Retry.",
      );
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.isSecureContext) {
      setStatus("insecure");
      setError("Location only works over HTTPS. Open MyAttendance from its https:// address.");
      return;
    }
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      setError("This browser can't share location. Use Chrome or Safari on your phone.");
      return;
    }
    setStatus((s) => (s === "active" ? s : "locating"));
    const id = navigator.geolocation.watchPosition(accept, reject, {
      enableHighAccuracy: true,
      maximumAge: 10_000,
      timeout: 30_000,
    });
    return () => navigator.geolocation.clearWatch(id);
  }, [accept, reject, nonce]);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  /**
   * A position for clocking: the watched fix if it is recent, otherwise a new reading.
   * Always settles within ~12 s, even if the browser never answers.
   */
  const fresh = useCallback(
    () =>
      new Promise<Fix>((resolve, reject) => {
        const cached = latest.current;
        if (cached && Date.now() - cached.at < 20_000) return resolve(cached);
        let done = false;
        const fallback = (message: string) => {
          if (done) return;
          done = true;
          const c = latest.current;
          if (c && Date.now() - c.at < 5 * 60_000) resolve(c);
          else reject(new Error(message));
        };
        const timer = window.setTimeout(() => fallback("Couldn't get your location in time. Move near a window and try again."), 12_000);
        navigator.geolocation.getCurrentPosition(
          (p) => {
            if (done) return;
            done = true;
            window.clearTimeout(timer);
            accept(p);
            resolve(latest.current!);
          },
          (e) => {
            window.clearTimeout(timer);
            fallback(e.code === e.PERMISSION_DENIED ? "Location access is blocked." : "Could not get your location. Try again.");
          },
          { enableHighAccuracy: true, maximumAge: 10_000, timeout: 11_000 },
        );
      }),
    [accept],
  );

  return { status, fix, error, retry, fresh };
}
