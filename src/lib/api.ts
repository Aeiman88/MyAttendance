"use client";

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

/** JSON fetch for the app's own API. Sends people to login or password change when needed. */
export async function api<T = Record<string, unknown>>(
  path: string,
  opts: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? (opts.body ? "POST" : "GET"),
      headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
      cache: "no-store",
      credentials: "same-origin",
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new ApiError(0, "No connection. Check your internet and try again.", "OFFLINE");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && data.code === "UNAUTHENTICATED") {
      window.location.href = "/login";
    } else if (res.status === 403 && data.code === "PASSWORD_CHANGE_REQUIRED") {
      window.location.href = "/change-password";
    }
    throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`, data.code, data);
  }
  return data as T;
}

export function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Something went wrong.";
}
