// One small database interface over two drivers:
//  • DATABASE_URL set   → real Postgres via postgres.js (Supabase, Neon, Docker Postgres…)
//  • DATABASE_URL unset → PGlite, an embedded Postgres stored in ./.data/pglite (local dev / demo)
// Both speak the same SQL, so the rest of the app never needs to know which one is running.

import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_HOLIDAYS,
  DEFAULT_SCHEDULE_CODE,
  DEFAULT_SCHEDULES,
  DEFAULT_SETTINGS,
  DEFAULT_ZONE,
  SCHEMA_SQL,
  SCHEMA_VERSION,
} from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

export interface Db {
  /** Parameterised query ($1, $2 …). Returns the rows. */
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
  /** First row or null. */
  one<T = Row>(text: string, params?: unknown[]): Promise<T | null>;
  /** Run several statements without parameters (schema scripts). */
  exec(text: string): Promise<void>;
  /** Run `fn` inside a transaction; throwing rolls it back. */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  readonly kind: "postgres" | "pglite";
}

type Global = typeof globalThis & { __myattendanceDb?: Promise<Db>; __myattendanceReady?: boolean };
const g = globalThis as Global;

export function getDb(): Promise<Db> {
  if (!g.__myattendanceDb) {
    g.__myattendanceDb = createDb()
      .then(async (db) => {
        await migrate(db);
        g.__myattendanceReady = true;
        return db;
      })
      .catch((err) => {
        g.__myattendanceDb = undefined; // let the next request retry
        throw err;
      });
  }
  return g.__myattendanceDb;
}

async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL?.trim();
  return url ? createPostgres(url) : createPglite();
}

async function createPostgres(url: string): Promise<Db> {
  const { default: postgres } = await import("postgres");
  const sql = postgres(url, {
    // Use Supabase's *Session* pooler (port 5432) or plain Postgres. Not the Transaction pooler (6543):
    // postgres.js pipelines concurrent queries, which Supabase warns can hang or mix up rows in transaction mode.
    prepare: false,
    // Session mode gives each connection its own database session, so keep the pool small on Vercel.
    max: Number(process.env.DB_POOL_MAX ?? (process.env.VERCEL ? 2 : 5)),
    idle_timeout: 20,
    connect_timeout: 15,
    onnotice: () => {},
    // Keep DATE columns as "YYYY-MM-DD" strings instead of JS Dates.
    types: {
      dateonly: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x },
    },
  });

  // If the tables disappear under a running server (database restored or recreated),
  // drop this connection pool so the next request connects again and recreates the schema.
  const guard = async <T>(run: () => Promise<T>): Promise<T> => {
    try {
      return await run();
    } catch (err) {
      if ((err as { code?: string })?.code === "42P01" && g.__myattendanceReady) {
        g.__myattendanceReady = false;
        g.__myattendanceDb = undefined;
        sql.end({ timeout: 5 }).catch(() => {});
      }
      throw err;
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrap = (s: any, inTx: boolean): Db => ({
    kind: "postgres",
    query: async (text, params = []) => (await guard<Row[]>(() => s.unsafe(text, params))) as never,
    one: async (text, params = []) => ((await guard<Row[]>(() => s.unsafe(text, params)))[0] ?? null) as never,
    exec: async (text) => {
      await s.unsafe(text);
    },
    tx: async (fn) => {
      if (inTx) return fn(wrap(s, true));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (await sql.begin((t: any) => fn(wrap(t, true)))) as never;
    },
  });
  return wrap(sql, false);
}

async function createPglite(): Promise<Db> {
  if (process.env.VERCEL) {
    throw new Error(
      "DATABASE_URL is not set. On Vercel, add your Supabase (or other Postgres) connection string as DATABASE_URL.",
    );
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR || path.join(process.cwd(), ".data", "pglite");
  fs.mkdirSync(dir, { recursive: true });
  const pg = await PGlite.create(dir, { parsers: { 1082: (v: string) => v } });

  // PGlite runs one query at a time; a simple queue keeps transactions from interleaving.
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(job: () => Promise<T>): Promise<T> => {
    const run = chain.then(job, job);
    chain = run.catch(() => undefined);
    return run;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrap = (c: any, inTx: boolean): Db => {
    const q = async (text: string, params: unknown[] = []) => (await c.query(text, params)).rows;
    return {
      kind: "pglite",
      query: (text, params) => (inTx ? q(text, params) : serial(() => q(text, params))) as never,
      one: async (text, params) => {
        const rows = inTx ? await q(text, params) : await serial(() => q(text, params));
        return (rows[0] ?? null) as never;
      },
      exec: async (text) => {
        await (inTx ? c.exec(text) : serial(() => c.exec(text)));
      },
      tx: async (fn) => {
        if (inTx) return fn(wrap(c, true));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return serial(() => pg.transaction((t: any) => fn(wrap(t, true))));
      },
    };
  };
  return wrap(pg, false);
}

/** Creates tables and default data the first time, and upgrades the schema when it changes. */
async function migrate(db: Db) {
  const ready = await db
    .one<{ value: string }>("select value from app_meta where key = 'schema_version'")
    .catch(() => null);
  if (ready?.value === SCHEMA_VERSION) return;

  await db.tx(async (t) => {
    if (t.kind === "postgres") await t.query("select pg_advisory_xact_lock(7270431)");
    await t.exec(SCHEMA_SQL);

    const hasSchedules = await t.one<{ n: number }>("select count(*)::int as n from schedules");
    if (!hasSchedules?.n) {
      for (const s of DEFAULT_SCHEDULES) {
        await t.query(
          "insert into schedules (code, name, start_time, end_time) values ($1, $2, $3, $4) on conflict (code) do nothing",
          [s.code, s.name, s.start, s.end],
        );
      }
    }
    const hasZones = await t.one<{ n: number }>("select count(*)::int as n from zones");
    if (!hasZones?.n) {
      await t.query("insert into zones (name, lat, lng, radius_m) values ($1, $2, $3, $4)", [
        DEFAULT_ZONE.name,
        DEFAULT_ZONE.lat,
        DEFAULT_ZONE.lng,
        DEFAULT_ZONE.radius_m,
      ]);
    }
    const def = await t.one<{ id: number }>("select id from schedules where code = $1", [DEFAULT_SCHEDULE_CODE]);
    const settings = { ...DEFAULT_SETTINGS, default_schedule_id: def ? String(def.id) : "" };
    for (const [key, value] of Object.entries(settings)) {
      await t.query("insert into settings (key, value) values ($1, $2) on conflict (key) do nothing", [key, value]);
    }
    const hasHolidays = await t.one<{ n: number }>("select count(*)::int as n from holidays");
    if (!hasHolidays?.n) {
      for (const [date, name] of DEFAULT_HOLIDAYS) {
        await t.query("insert into holidays (date, name) values ($1, $2) on conflict (date) do nothing", [date, name]);
      }
    }
    await t.query(
      "insert into app_meta (key, value) values ('schema_version', $1) on conflict (key) do update set value = excluded.value",
      [SCHEMA_VERSION],
    );
  });
}

// ---------- small helpers used across the app ----------

export async function getSettings(db: Db): Promise<Record<string, string>> {
  const rows = await db.query<{ key: string; value: string }>("select key, value from settings");
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function audit(db: Db, actorId: number | null, action: string, target: string, details?: unknown) {
  await db.query("insert into audit_log (actor_id, action, target, details) values ($1, $2, $3, $4)", [
    actorId,
    action,
    target,
    details === undefined ? null : JSON.stringify(details),
  ]);
}
