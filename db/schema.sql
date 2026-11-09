-- MyAttendance database schema (PostgreSQL 14+).
-- The app creates these tables by itself on first start, so you only need this file if you
-- prefer to set the database up by hand, e.g. by pasting it into the Supabase SQL editor.
-- Default data (zone, working hours, holidays, settings) is added by the app on first start.

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
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

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
