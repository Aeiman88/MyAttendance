import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform } from "react-native";
import * as Location from "expo-location";

export type Fix = { lat: number; lng: number; accuracy: number; at: number; mocked: boolean };
export type GeoStatus = "locating" | "active" | "denied" | "off" | "error";

/**
 * Watches the phone's position while `enabled` (the Clock screen is open).
 * `fresh()` returns a position for clocking: the watched fix if recent, otherwise a new reading.
 */
export function useLocation(enabled: boolean) {
  const [status, setStatus] = useState<GeoStatus>("locating");
  const [fix, setFix] = useState<Fix | null>(null);
  const [canAsk, setCanAsk] = useState(true);
  const latest = useRef<Fix | null>(null);
  const sub = useRef<Location.LocationSubscription | null>(null);
  const [nonce, setNonce] = useState(0);

  const accept = useCallback((loc: Location.LocationObject) => {
    const f: Fix = {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      accuracy: loc.coords.accuracy ?? 9999,
      at: Date.now(),
      mocked: !!loc.mocked,
    };
    latest.current = f;
    setFix(f);
    setStatus("active");
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        setCanAsk(perm.canAskAgain);
        if (perm.status !== "granted") return setStatus("denied");
        if (Platform.OS !== "web" && !(await Location.hasServicesEnabledAsync())) return setStatus("off");
        if (!latest.current) setStatus("locating");
        sub.current?.remove();
        sub.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 4000, distanceInterval: 3 },
          (loc) => !cancelled && accept(loc),
          () => !cancelled && !latest.current && setStatus("error"),
        );
      } catch {
        if (!cancelled && !latest.current) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      sub.current?.remove();
      sub.current = null;
    };
  }, [enabled, nonce, accept]);

  // Coming back from Settings (e.g. after turning GPS on) restarts the watch.
  useEffect(() => {
    const s = AppState.addEventListener("change", (state) => {
      if (state === "active" && enabled) setNonce((n) => n + 1);
    });
    return () => s.remove();
  }, [enabled]);

  const retry = useCallback(() => {
    if (status === "denied" && !canAsk) Linking.openSettings();
    else if (status === "off" && Platform.OS === "android") {
      Location.enableNetworkProviderAsync()
        .catch(() => {})
        .finally(() => setNonce((n) => n + 1));
    } else setNonce((n) => n + 1);
  }, [status, canAsk]);

  const fresh = useCallback(async (): Promise<Fix> => {
    const cached = latest.current;
    if (cached && Date.now() - cached.at < 20_000) return cached;
    const reading = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }).then((loc) => {
      accept(loc);
      return latest.current!;
    });
    const timeout = new Promise<null>((r) => setTimeout(() => r(null), 12_000));
    const got = await Promise.race([reading.catch(() => null), timeout]);
    if (got) return got;
    const c = latest.current;
    if (c && Date.now() - c.at < 5 * 60_000) return c;
    throw new Error("Couldn't get your location in time. Move near a window or outdoors and try again.");
  }, [accept]);

  return { status, fix, canAsk, retry, fresh };
}
