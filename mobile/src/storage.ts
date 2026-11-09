import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// The login token and server address live in the phone's secure storage (Keychain / Keystore).
// The web build (used only for testing) falls back to localStorage.
const web = Platform.OS === "web";

export async function getItem(key: string): Promise<string | null> {
  if (web) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (web) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* private mode */
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function removeItem(key: string): Promise<void> {
  if (web) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
