// Database schema for MyAttendance. Every statement is idempotent, so it is safe to run
// on every start. The same SQL lives in db/schema.sql for people who prefer to run it by hand
// (for example in the Supabase SQL editor).

// v2: staff app (app download link, web clock-in switch). Bumping the version re-runs the
// idempotent schema and adds any new default settings without touching existing data.
// v3: a zone can be a drawn area (zones.polygon) instead of a circle.
export const SCHEMA_VERSION = "3";

export const SCHEMA_SQL = /* sql */ `
create table if not exists app_meta (
  key   text primary key,
  value text not null
);

create table if not exists schedules (
  id            serial primary key,
  code          text not null unique,
  name          text not null,
  start_time    text not null check (start_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  end_time      text not null check (end_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  grace_minutes int  not null default 0 check (grace_minutes between 0 and 120),
  work_days     int[] not null default '{1,2,3,4,5}',
  created_at    timestamptz not null default now()
);

create table if not exists staff (
  id                   serial primary key,
  staff_no             text not null,
  full_name            text not null,
  position             text not null default '',
  email                text not null default '',
  phone                text not null default '',
  role                 text not null default 'staff' check (role in ('staff', 'admin')),
  schedule_id          int references schedules(id) on delete set null,
  password_hash        text not null,
  must_change_password boolean not null default true,
  token_version        int not null default 0,
  signature            text,
  active               boolean not null default true,
  last_login_at        timestamptz,
  created_at           timestamptz not null default now()
);
create unique index if not exists staff_no_unique on staff (lower(staff_no));

create table if not exists zones (
  id         serial primary key,
  name       text not null,
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180),
  radius_m   int not null default 200 check (radius_m between 20 and 5000),
  polygon    jsonb,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
-- v3: drawn areas. Corners as [[lat, lng], ...]; null for a circle. For an area, lat/lng is its
-- centre and radius_m reaches the farthest corner.
alter table zones add column if not exists polygon jsonb;

create table if not exists attendance (
  id             serial primary key,
  staff_id       int not null references staff(id) on delete cascade,
  work_date      date not null,
  clock_in       timestamptz,
  in_lat         double precision,
  in_lng         double precision,
  in_accuracy    real,
  in_zone        text check (in_zone in ('internal', 'external')),
  in_zone_name   text,
  in_distance_m  real,
  in_note        text,
  in_device      text,
  clock_out      timestamptz,
  out_lat        double precision,
  out_lng        double precision,
  out_accuracy   real,
  out_zone       text check (out_zone in ('internal', 'external')),
  out_zone_name  text,
  out_distance_m real,
  out_note       text,
  out_device     text,
  remark         text,
  source         text not null default 'app' check (source in ('app', 'manual', 'request')),
  updated_by     int references staff(id) on delete set null,
  updated_at     timestamptz,
  created_at     timestamptz not null default now(),
  unique (staff_id, work_date)
);
create index if not exists attendance_work_date on attendance (work_date);

create table if not exists requests (
  id          serial primary key,
  staff_id    int not null references staff(id) on delete cascade,
  type        text not null check (type in ('cuti', 'mc', 'kursus', 'tugas_luar', 'pembetulan', 'lain')),
  date_from   date not null,
  date_to     date not null,
  time_in     text,
  time_out    text,
  reason      text not null,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_by int references staff(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at  timestamptz not null default now(),
  check (date_to >= date_from)
);
create index if not exists requests_staff_status on requests (staff_id, status);

create table if not exists holidays (
  date date primary key,
  name text not null
);

create table if not exists settings (
  key   text primary key,
  value text not null
);

create table if not exists audit_log (
  id         serial primary key,
  actor_id   int references staff(id) on delete set null,
  action     text not null,
  target     text,
  details    text,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_created on audit_log (created_at desc);
`;

// Default working-hour slots, modelled on the civil-service WBB pattern.
export const DEFAULT_SCHEDULES = [
  { code: "WP1", name: "7:30 AM – 4:30 PM", start: "07:30", end: "16:30" },
  { code: "WP2", name: "8:00 AM – 5:00 PM", start: "08:00", end: "17:00" },
  { code: "WP3", name: "8:30 AM – 5:30 PM", start: "08:30", end: "17:30" },
];
export const DEFAULT_SCHEDULE_CODE = "WP2";

// Kota Kinabalu High School (Sekolah Tinggi Kota Kinabalu), Bukit Padang.
// Admins can move the zone onto the DAICOE AI Center building from Settings.
export const DEFAULT_ZONE = {
  name: "DAICOE AI Center, KKHS",
  lat: 5.9458845,
  lng: 116.070886,
  radius_m: 200,
};

export const DEFAULT_SETTINGS: Record<string, string> = {
  outside_zone_policy: "reason", // "reason" = allow with a reason, "block" = not allowed
  max_accuracy_m: "1000",
  print_title: "Rekod Kedatangan Pekerja Lembaga Pengurusan Sekolah Tinggi Kota Kinabalu",
  org_name: "DAICOE AI Center",
  // Staff clock in with the phone app. "1" also allows clocking in from a web browser
  // (e.g. for someone with an iPhone before the iPhone app is published).
  web_clock_in: "0",
  // Where staff download the Android app (APK link from EAS, Google Drive, etc.).
  app_download_url: "",
};

// Sabah public holidays 2026 — Kalendar Kerajaan Negeri Sabah 2026 (Jabatan Cetak Kerajaan Sabah),
// plus the 9 November replacement day for Deepavali. Add later years from Settings → Holidays.
export const DEFAULT_HOLIDAYS: Array<[string, string]> = [
  ["2026-01-01", "Tahun Baharu"],
  ["2026-02-17", "Tahun Baharu Cina"],
  ["2026-02-18", "Tahun Baharu Cina (Hari Kedua)"],
  ["2026-03-21", "Hari Raya Aidilfitri"],
  ["2026-03-22", "Hari Raya Aidilfitri (Hari Kedua)"],
  ["2026-03-30", "Hari Jadi TYT Yang di-Pertua Negeri Sabah"],
  ["2026-04-03", "Good Friday"],
  ["2026-05-01", "Hari Pekerja"],
  ["2026-05-27", "Hari Raya Aidiladha"],
  ["2026-05-30", "Pesta Kaamatan"],
  ["2026-05-31", "Pesta Kaamatan (Hari Kedua) dan Hari Wesak"],
  ["2026-06-01", "Hari Keputeraan Rasmi Seri Paduka Baginda Yang di-Pertuan Agong"],
  ["2026-06-17", "Awal Muharam"],
  ["2026-08-25", "Maulidur Rasul"],
  ["2026-08-31", "Hari Kebangsaan"],
  ["2026-09-16", "Hari Malaysia"],
  ["2026-11-08", "Hari Deepavali"],
  ["2026-11-09", "Cuti Ganti Hari Deepavali"],
  ["2026-12-24", "Malam Krismas"],
  ["2026-12-25", "Hari Krismas"],
];
