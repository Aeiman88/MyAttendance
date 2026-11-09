import { Platform } from "react-native";
import { getItem, removeItem, setItem } from "./storage";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public data?: Record<string, unknown>,
  ) {
    super(message);
  }
}

// ---------- server address ----------

/** Set at build time in eas.json (EXPO_PUBLIC_API_URL). Staff can still change it on the login screen. */
const BUILT_IN = (process.env.EXPO_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");
const SERVER_KEY = "server_url";

export function normalizeServer(input: string) {
  let url = input.trim();
  if (!url) return "";
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url.replace(/\/+$/, "");
}

export async function loadServer(): Promise<string> {
  const saved = await getItem(SERVER_KEY);
  if (saved) return saved;
  if (BUILT_IN) return BUILT_IN;
  // The web build (testing only) talks to the server it is served from.
  if (Platform.OS === "web" && typeof window !== "undefined") return window.location.origin;
  return "";
}

export async function saveServer(url: string) {
  await setItem(SERVER_KEY, url);
}

/** Confirms the address belongs to a MyAttendance server. */
export async function checkServer(url: string): Promise<{ orgName: string }> {
  let res: Response;
  try {
    res = await withTimeout(fetch(`${url}/api/health`, { headers: { Accept: "application/json" } }), 12_000);
  } catch {
    throw new ApiError(0, "Can't reach that address. Check it, and your internet connection.", "OFFLINE");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.app !== "myattendance") {
    throw new ApiError(res.status, "That address isn't a MyAttendance server.", "NOT_MYATTENDANCE");
  }
  return { orgName: data.orgName ?? "DAICOE" };
}

// ---------- session ----------

const TOKEN_KEY = "session_token";
let base = "";
let token: string | null = null;
let onSignedOut: (() => void) | null = null;
let onPasswordChange: (() => void) | null = null;

export function configureApi(opts: { base: string; token: string | null; onSignedOut: () => void; onPasswordChange: () => void }) {
  base = opts.base;
  token = opts.token;
  onSignedOut = opts.onSignedOut;
  onPasswordChange = opts.onPasswordChange;
}

export const loadToken = () => getItem(TOKEN_KEY);
export async function saveToken(t: string | null) {
  token = t;
  if (t) await setItem(TOKEN_KEY, t);
  else await removeItem(TOKEN_KEY);
}
export function setBase(url: string) {
  base = url;
}
export const serverBase = () => base;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** JSON request to the MyAttendance server with the saved login token. */
export async function api<T = Record<string, unknown>>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  if (!base) throw new ApiError(0, "Set the server address first.", "NO_SERVER");
  let res: Response;
  try {
    res = await withTimeout(
      fetch(base + path, {
        method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
        headers: {
          Accept: "application/json",
          ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      }),
      25_000,
    );
  } catch {
    throw new ApiError(0, "No connection to the server. Check your internet and try again.", "OFFLINE");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && data.code === "UNAUTHENTICATED") onSignedOut?.();
    if (res.status === 403 && data.code === "PASSWORD_CHANGE_REQUIRED") onPasswordChange?.();
    throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`, data.code, data);
  }
  return data as T;
}

export function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Something went wrong.";
}
