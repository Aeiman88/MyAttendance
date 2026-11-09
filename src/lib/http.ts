import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const json = (data: unknown, init?: number | ResponseInit) =>
  NextResponse.json(data, typeof init === "number" ? { status: init } : init);

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Wraps a route handler: same-origin check for writes, consistent JSON errors. */
export function route<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") assertSameOrigin(req);
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) {
        return json({ error: err.message, code: err.code, ...err.extra }, err.status);
      }
      if (err instanceof ZodError) {
        const first = err.issues[0];
        const field = first?.path?.join(".");
        return json({ error: field ? `${field}: ${first.message}` : "Invalid request", code: "INVALID" }, 400);
      }
      console.error("[api]", req.method, new URL(req.url).pathname, err);
      return json({ error: "Something went wrong on the server. Try again." }, 500);
    }
  };
}

/**
 * Blocks cross-site writes (CSRF). Modern browsers say where a request came from in Sec-Fetch-Site,
 * which works even behind proxies that rewrite the Host header. Older browsers fall back to Origin vs Host.
 */
function assertSameOrigin(req: Request) {
  // The phone app authenticates with a Bearer token, which browsers never attach on their own,
  // so cross-site request forgery doesn't apply to it.
  if (req.headers.get("authorization")?.toLowerCase().startsWith("bearer ")) return;
  const site = req.headers.get("sec-fetch-site");
  if (site) {
    if (site === "same-origin" || site === "none") return;
    throw new HttpError(403, "Request blocked: it did not come from this app.");
  }
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients; the session cookie is SameSite=Lax anyway
  const allowed = [
    req.headers.get("x-forwarded-host"),
    req.headers.get("host"),
    ...(process.env.APP_ORIGINS ?? "").split(",").map((s) => s.trim().replace(/^https?:\/\//, "")),
  ].filter(Boolean);
  try {
    if (allowed.includes(new URL(origin).host)) return;
  } catch {
    /* fall through */
  }
  throw new HttpError(403, "Request blocked: it did not come from this app.");
}

export async function body<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    throw new HttpError(400, "Expected a JSON body.");
  }
  return schema.parse(data);
}

export function isHttps(req: Request) {
  const proto = req.headers.get("x-forwarded-proto");
  if (proto) return proto.split(",")[0].trim() === "https";
  return new URL(req.url).protocol === "https:";
}
