import { Platform } from "react-native";
import * as Application from "expo-application";
import { getItem, setItem } from "./storage";

let cached: string | null = null;

/**
 * A stable ID for this phone (Android ID / iOS identifierForVendor). Sent with each clock-in so the
 * admin can spot one phone clocking in for two people on the same day.
 */
export async function deviceId(): Promise<string | undefined> {
  if (cached) return cached;
  try {
    let id: string | null = null;
    if (Platform.OS === "android") id = Application.getAndroidId();
    else if (Platform.OS === "ios") id = await Application.getIosIdForVendorAsync();
    if (!id) {
      id = await getItem("device_id");
      if (!id) {
        id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
        await setItem("device_id", id);
      }
    }
    cached = id.replace(/[^A-Za-z0-9-]/g, "").slice(0, 64);
    return cached;
  } catch {
    return undefined;
  }
}
