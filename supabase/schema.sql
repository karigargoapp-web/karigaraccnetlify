-- ============================================================
-- KarigarGo — Complete Supabase Database Schema
-- Run this ENTIRE file in your Supabase SQL Editor (one shot).
-- It creates: enums, tables, indexes, RLS policies, triggers,
-- helper functions, realtime config, and storage buckets.
-- ============================================================

-- ========================
-- 0. EXTENSIONS
-- ========================
create extension if not exists "uuid-ossp";      -- uuid_generate_v4()
create extension if not exists "pgcrypto";        -- gen_random_uuid() (used by Supabase auth)

-- ========================
-- 1. CUSTOM ENUM TYPES
-- ========================
do $$ begin
  create type user_role      as enum ('customer','worker','admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type job_status     as enum (
    'pending',            -- customer posted, waiting for bids
    'bidAccepted',        -- customer accepted a bid, worker is on the way
    'inspectionDone',     -- worker finished physical inspection
    'workCostProposed',   -- worker sent a work cost quote
    'workCostAccepted',   -- customer approved the work cost
    'workCostRejected',   -- customer rejected the work cost (Case B — pays inspection only)
    'completed',          -- customer marked job as done
    'cancelled'           -- either party cancelled
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type bid_status     as enum ('pending','accepted','rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type notif_type     as enum (
    'bid_received','bid_accepted','bid_rejected',
    'job_update','message','review','system'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type report_status  as enum ('open','resolved');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type report_entity  as enum ('user','job');
exception when duplicate_object then null;
end $$;


-- ========================
-- 2. TABLES
-- ========================

-- ─────────── USERS ───────────
-- One row per authenticated account (customer, worker, or admin).
-- The id matches auth.users.id so Supabase RLS can use auth.uid().
create table if not exists users (
  id                uuid primary key references auth.users(id) on delete cascade,
  name              text        not null,
  email             text        unique,
  phone             text,
  role              user_role   not null default 'customer',
  profile_photo_url text,
  city              text,
  verified          boolean     not null default false,
  avg_rating        numeric(2,1) not null default 0.0,
  total_reviews     integer     not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
-- Client app enforces: email format; password strength (8+ chars, upper, lower, digit, special);
-- Pakistan CNIC 13 digits; mobile 03XXXXXXXXX; name letters/spaces (see src/lib/validation.ts).
-- profile_complete: false for Google OAuth new users until they fill CNIC/city on the completion page.

-- ─────────── WORKER PROFILES ───────────
-- Extra info for workers only (skills, CNIC docs, stats).
create table if not exists worker_profiles (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid        not null unique references users(id) on delete cascade,
  skills            text[]      not null default '{}',
  bio               text,
  cnic              text,                    -- cnic number string
  cnic_front_url    text,
  cnic_back_url     text,
  certificate_urls  text[],
  avg_rating        numeric(2,1) not null default 0.0,
  total_jobs        integer      not null default 0,
  total_earnings    integer      not null default 0,
  created_at        timestamptz  not null default now()
);

-- ─────────── JOBS ───────────
-- The central entity. Tracks the full lifecycle from posting → completion.
create table if not exists jobs (
  id                  uuid primary key default uuid_generate_v4(),
  title               text        not null,
  description         text        not null,
  category            text        not null,
  location            text        not null,
  latitude            double precision,
  longitude           double precision,
  budget              integer     not null default 0,
  date                text,                     -- user-selected preferred date
  time                text,                     -- user-selected preferred time
  image_url           text,
  voice_note_url      text,
  status              job_status  not null default 'pending',

  -- Customer who posted the job
  customer_id         uuid        not null references users(id) on delete cascade,
  customer_name       text        not null,
  customer_photo      text,

  -- Worker assigned after bid acceptance
  worker_id           uuid        references users(id) on delete set null,
  worker_name         text,

  -- Financial fields
  inspection_charges  integer,                 -- from the accepted bid
  work_cost           integer,                 -- proposed by worker after inspection
  platform_fee        integer,                 -- 10% of (inspection + work_cost)

  -- City (auto-assigned from customer's registered city for location-based filtering)
  city                text,

  -- Timestamps
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ─────────── BIDS ───────────
-- Workers bid on pending jobs. Max one bid per worker per job.
create table if not exists bids (
  id                  uuid primary key default uuid_generate_v4(),
  job_id              uuid        not null references jobs(id) on delete cascade,
  worker_id           uuid        not null references users(id) on delete cascade,
  worker_name         text        not null,
  worker_photo        text,
  skill               text,
  inspection_charges  integer     not null default 0 check (inspection_charges <= 300),
  message             text,
  rating              numeric(2,1) not null default 0.0,   -- snapshot of worker rating at bid time
  distance            text,                                 -- e.g. "2.3 km"
  verified            boolean     not null default false,   -- snapshot of worker verified status
  status              bid_status  not null default 'pending',
  created_at          timestamptz not null default now(),

  -- One bid per worker per job
  unique(job_id, worker_id)
);

-- ─────────── MESSAGES (Chat) ───────────
-- Real-time in-job chat between customer ↔ worker.
create table if not exists messages (
  id          uuid primary key default uuid_generate_v4(),
  job_id      uuid        not null references jobs(id) on delete cascade,
  sender_id   uuid        not null references users(id) on delete cascade,
  text        text        not null default '',
  image_url   text,
  voice_url   text,
  video_url   text,
  is_customer boolean     not null default true,
  read        boolean     not null default false,
  created_at  timestamptz not null default now()
);

-- ─────────── REVIEWS ───────────
-- Customer reviews a worker after job completion.
create table if not exists reviews (
  id              uuid primary key default uuid_generate_v4(),
  job_id          uuid    not null references jobs(id) on delete cascade,
  reviewer_id     uuid    not null references users(id) on delete cascade,
  reviewer_name   text    not null,
  worker_id       uuid    not null references users(id) on delete cascade,
  rating          integer not null check (rating >= 1 and rating <= 5),
  comment         text,
  direction       text    not null default 'customer_to_worker' check (direction in ('customer_to_worker', 'worker_to_customer')),
  created_at      timestamptz not null default now(),

  -- One review per direction per job
  unique(job_id, reviewer_id, direction)
);

-- ─────────── NOTIFICATIONS ───────────
-- Push / in-app alerts. Realtime-subscribed per user.
create table if not exists notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid        not null references users(id) on delete cascade,
  type        notif_type  not null default 'system',
  title       text        not null,
  body        text        not null default '',
  read        boolean     not null default false,
  data        jsonb,                          -- arbitrary payload (e.g. { job_id, bid_id })
  created_at  timestamptz not null default now()
);

-- ─────────── WORKER LOCATIONS ───────────
-- Live GPS broadcast while a worker is en-route / on-site.
-- One active location per worker (uses UPSERT).
create table if not exists worker_locations (
  user_id     uuid primary key references users(id) on delete cascade,
  job_id      uuid references jobs(id) on delete set null,
  latitude    double precision not null,
  longitude   double precision not null,
  updated_at  timestamptz not null default now()
);

-- ─────────── REPORTS / DISPUTES ───────────
-- Admin moderation queue.
create table if not exists reports (
  id            uuid primary key default uuid_generate_v4(),
  entity_type   report_entity not null,
  entity_id     text          not null,       -- user id or job id
  entity_name   text          not null,
  reason        text          not null,
  flagged_by    uuid          not null references users(id) on delete cascade,
  status        report_status not null default 'open',
  notes         text,
  created_at    timestamptz   not null default now()
);


-- ========================
-- 3. INDEXES (Query Performance)
-- ========================

-- Jobs: the most queried table
create index if not exists idx_jobs_customer    on jobs(customer_id);
create index if not exists idx_jobs_worker      on jobs(worker_id);
create index if not exists idx_jobs_status      on jobs(status);
create index if not exists idx_jobs_created     on jobs(created_at desc);
create index if not exists idx_jobs_completed   on jobs(completed_at desc) where status = 'completed';

-- Bids
create index if not exists idx_bids_job         on bids(job_id);
create index if not exists idx_bids_worker      on bids(worker_id);

-- Messages: for chat scroll
create index if not exists idx_msgs_job         on messages(job_id, created_at);

-- Reviews
create index if not exists idx_reviews_worker   on reviews(worker_id);

-- Notifications
create index if not exists idx_notif_user       on notifications(user_id, created_at desc);
create index if not exists idx_notif_unread     on notifications(user_id) where read = false;

-- Reports
create index if not exists idx_reports_status   on reports(status);


-- ========================
-- 4. AUTOMATIC updated_at TRIGGER
-- ========================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply to tables that have updated_at
do $$ begin
  create trigger trg_users_updated_at
    before update on users
    for each row execute function update_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger trg_jobs_updated_at
    before update on jobs
    for each row execute function update_updated_at();
exception when duplicate_object then null;
end $$;


-- ========================
-- 5. NOTIFICATION HELPER FUNCTION
-- ========================
-- Call this from the app or from other triggers to create a notification.

create or replace function create_notification(
  p_user_id uuid,
  p_type    notif_type,
  p_title   text,
  p_body    text default '',
  p_data    jsonb default null
)
returns void as $$
begin
  insert into notifications (user_id, type, title, body, data)
  values (p_user_id, p_type, p_title, p_body, p_data);
end;
$$ language plpgsql security definer;


-- ========================
-- 6. AUTO-NOTIFICATION TRIGGERS
-- ========================

-- 6a. When a new bid is placed → notify the customer
create or replace function notify_new_bid()
returns trigger as $$
declare
  v_job record;
begin
  select customer_id, title into v_job from jobs where id = new.job_id;
  perform create_notification(
    v_job.customer_id,
    'bid_received',
    'New bid on "' || v_job.title || '"',
    new.worker_name || ' bid ₨' || new.inspection_charges || ' for inspection',
    jsonb_build_object('job_id', new.job_id, 'bid_id', new.id)
  );
  return new;
end;
$$ language plpgsql security definer;

do $$ begin
  create trigger trg_notify_new_bid
    after insert on bids
    for each row execute function notify_new_bid();
exception when duplicate_object then null;
end $$;

-- 6b. When bid status changes → notify the worker
create or replace function notify_bid_status_change()
returns trigger as $$
declare
  v_job_title text;
begin
  if old.status = new.status then return new; end if;

  select title into v_job_title from jobs where id = new.job_id;

  if new.status = 'accepted' then
    perform create_notification(
      new.worker_id, 'bid_accepted',
      'Bid accepted! 🎉',
      'Your bid on "' || v_job_title || '" was accepted.',
      jsonb_build_object('job_id', new.job_id)
    );
  elsif new.status = 'rejected' then
    perform create_notification(
      new.worker_id, 'bid_rejected',
      'Bid not selected',
      'Your bid on "' || v_job_title || '" was not selected.',
      jsonb_build_object('job_id', new.job_id)
    );
  end if;

  return new;
end;
$$ language plpgsql security definer;

do $$ begin
  create trigger trg_notify_bid_status
    after update on bids
    for each row execute function notify_bid_status_change();
exception when duplicate_object then null;
end $$;

-- 6c. BEFORE trigger — compute platform_fee + stamp completed_at
-- NOTE: This and trg_jobs_updated_at both fire BEFORE UPDATE on jobs.
-- Postgres fires them alphabetically (compute < jobs), which is fine
-- since they touch different columns (platform_fee/completed_at vs updated_at).
create or replace function compute_platform_fee()
returns trigger as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    new.platform_fee := round(
      (coalesce(new.inspection_charges, 0) + coalesce(new.work_cost, 0)) * 0.10
    );
    new.completed_at := now();
  end if;
  return new;
end;
$$ language plpgsql;

do $$ begin
  create trigger trg_compute_platform_fee
    before update on jobs
    for each row execute function compute_platform_fee();
exception when duplicate_object then null;
end $$;

-- 6d. AFTER trigger — send notifications (INSERTs into notifications are safe here)
create or replace function notify_job_status_change()
returns trigger as $$
begin
  if old.status = new.status then return new; end if;

  -- Notify customer when bid is accepted (worker is on the way)
  if new.status = 'bidAccepted' and new.worker_id is not null then
    perform create_notification(
      new.customer_id, 'job_update',
      'Worker on the way 🚗',
      coalesce(new.worker_name, 'A worker') || ' has accepted and is heading to you.',
      jsonb_build_object('job_id', new.id)
    );
  end if;

  -- Notify worker when customer approves cost
  if new.status = 'workCostAccepted' and new.worker_id is not null then
    perform create_notification(
      new.worker_id, 'job_update',
      'Cost approved ✅',
      'Customer approved ₨' || coalesce(new.work_cost, 0) || ' for "' || new.title || '". Start the work!',
      jsonb_build_object('job_id', new.id)
    );
  end if;

  -- Notify worker when customer rejects cost (Case B)
  if new.status = 'workCostRejected' and new.worker_id is not null then
    perform create_notification(
      new.worker_id, 'job_update',
      'Cost rejected ❌',
      'Customer rejected the proposed cost for "' || new.title || '". Only inspection fee applies.',
      jsonb_build_object('job_id', new.id)
    );
  end if;

  if new.status = 'inspectionDone' then
    perform create_notification(
      new.customer_id, 'job_update',
      'Inspection completed',
      'Worker finished inspecting "' || new.title || '". A work cost will be proposed soon.',
      jsonb_build_object('job_id', new.id)
    );
  end if;

  if new.status = 'workCostProposed' then
    perform create_notification(
      new.customer_id, 'job_update',
      'Work cost proposed 💰',
      'Worker proposed ₨' || coalesce(new.work_cost, 0) || ' for "' || new.title || '"',
      jsonb_build_object('job_id', new.id)
    );
  end if;

  if new.status = 'completed' then
    if new.worker_id is not null then
      perform create_notification(
        new.worker_id, 'job_update',
        'Job completed! 🎉',
        '"' || new.title || '" has been marked complete.',
        jsonb_build_object('job_id', new.id)
      );
    end if;
  end if;

  if new.status = 'cancelled' then
    if new.worker_id is not null then
      perform create_notification(
        new.worker_id, 'job_update',
        'Job cancelled ❌',
        '"' || new.title || '" has been cancelled.',
        jsonb_build_object('job_id', new.id)
      );
    end if;
    perform create_notification(
      new.customer_id, 'job_update',
      'Job cancelled ❌',
      '"' || new.title || '" has been cancelled.',
      jsonb_build_object('job_id', new.id)
    );
  end if;

  return new;
end;
$$ language plpgsql security definer;

do $$ begin
  create trigger trg_notify_job_status
    after update on jobs
    for each row execute function notify_job_status_change();
exception when duplicate_object then null;
end $$;

-- 6e. When a review is submitted → notify the worker
create or replace function notify_new_review()
returns trigger as $$
begin
  -- If customer reviewed worker -> notify worker
  if new.direction = 'customer_to_worker' then
    perform create_notification(
      new.worker_id, 'review',
      'New review (' || new.rating || '★)',
      new.reviewer_name || ' left a review' || coalesce(': "' || left(new.comment, 60) || '"', ''),
      jsonb_build_object('job_id', new.job_id)
    );
  -- If worker reviewed customer (using worker_id as the target to be reviewed here is a bit tricky, 
  -- actually reviewer_id is the worker and worker_id is the customer contextually, wait.
  -- Let's define: reviewer_id = person writing it, worker_id = person receiving it.
  -- So if direction = worker_to_customer, reviewer_id is the worker context, worker_id is the customer receiving it.)
  else
    perform create_notification(
      new.worker_id, 'review',
      'New review (' || new.rating || '★)',
      new.reviewer_name || ' left a review' || coalesce(': "' || left(new.comment, 60) || '"', ''),
      jsonb_build_object('job_id', new.job_id)
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

do $$ begin
  create trigger trg_notify_new_review
    after insert on reviews
    for each row execute function notify_new_review();
exception when duplicate_object then null;
end $$;

-- 6f. When a review is submitted → update worker_profiles or users stats
create or replace function update_user_rating_stats()
returns trigger as $$
begin
  if new.direction = 'customer_to_worker' then
    update worker_profiles
    set
      avg_rating = (
        select round(coalesce(avg(rating), 0)::numeric, 1)
        from reviews
        where worker_id = new.worker_id and direction = 'customer_to_worker'
      ),
      total_jobs = (
        select count(*)
        from jobs
        where worker_id = new.worker_id and status = 'completed'
      ),
      total_earnings = (
        select coalesce(sum(coalesce(inspection_charges, 0) + coalesce(work_cost, 0)), 0)
        from jobs
        where worker_id = new.worker_id and status = 'completed'
      )
    where user_id = new.worker_id;
  else
    update users
    set
      avg_rating = (
        select round(coalesce(avg(rating), 0)::numeric, 1)
        from reviews
        where worker_id = new.worker_id and direction = 'worker_to_customer'
      ),
      total_reviews = (
        select count(*)
        from reviews
        where worker_id = new.worker_id and direction = 'worker_to_customer'
      )
    where id = new.worker_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

do $$ begin
  create trigger trg_update_user_rating_stats
    after insert on reviews
    for each row execute function update_user_rating_stats();
exception when duplicate_object then null;
end $$;


-- ========================
-- 7. ROW LEVEL SECURITY — MVP (mostly open, few essentials)
-- ========================
-- Mostly open for fast development. Only 3 guardrails:
--   1. Users can only UPDATE their own row (not others')
--   2. Workers can only UPDATE their own worker_profile
--   3. Reports table is admin-only
-- Everything else is wide open. Tighten before production.

alter table users             enable row level security;
alter table worker_profiles   enable row level security;
alter table jobs              enable row level security;
alter table bids              enable row level security;
alter table messages          enable row level security;
alter table reviews           enable row level security;
alter table notifications     enable row level security;
alter table worker_locations  enable row level security;
alter table reports           enable row level security;

-- Helper: check if current user is admin
create or replace function is_admin()
returns boolean as $$
begin
  return exists (select 1 from users where id = auth.uid() and role = 'admin');
end;
$$ language plpgsql security definer stable;

-- ─── USERS ───
create policy "users_read"    on users for select using (true);
create policy "users_insert"  on users for insert with check (true);
create policy "users_update"  on users for update using (auth.uid() = id or is_admin());
create policy "users_delete"  on users for delete using (is_admin());

-- ─── WORKER PROFILES ───
create policy "wp_read"       on worker_profiles for select using (true);
create policy "wp_insert"     on worker_profiles for insert with check (true);
create policy "wp_update"     on worker_profiles for update using (auth.uid() = user_id or is_admin());
create policy "wp_delete"     on worker_profiles for delete using (is_admin());

-- ─── JOBS / BIDS / MESSAGES / REVIEWS / NOTIFICATIONS / LOCATIONS ───
-- Wide open for MVP
create policy "allow_all" on jobs             for all using (true) with check (true);
create policy "allow_all" on bids             for all using (true) with check (true);
create policy "allow_all" on messages         for all using (true) with check (true);
create policy "allow_all" on reviews          for all using (true) with check (true);
create policy "allow_all" on notifications    for all using (true) with check (true);
create policy "allow_all" on worker_locations for all using (true) with check (true);

-- ─── REPORTS — anyone can file, only admin can read/manage ───
create policy "reports_insert" on reports for insert with check (true);
create policy "reports_read"   on reports for select using (is_admin());
create policy "reports_manage" on reports for update using (is_admin());
create policy "reports_delete" on reports for delete using (is_admin());


-- ========================
-- 8. ENABLE SUPABASE REALTIME
-- ========================

do $$ begin
  alter publication supabase_realtime add table jobs;
exception when others then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table messages;
exception when others then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table notifications;
exception when others then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table worker_locations;
exception when others then null;
end $$;


-- ========================
-- 9. STORAGE BUCKETS
-- ========================

insert into storage.buckets (id, name, public)
values
  ('avatars',       'avatars',       true),
  ('signup-docs',   'signup-docs',   false),  -- PRIVATE: contains CNIC scans
  ('job-images',    'job-images',    true),
  ('message-media', 'message-media', true)
on conflict (id) do nothing;

-- Storage: allow ALL operations for everyone (MVP)
do $$ begin
  create policy "storage_allow_all" on storage.objects for all using (true) with check (true);
exception when duplicate_object then null;
end $$;


-- ========================
-- 10. SEED: DEFAULT ADMIN ACCOUNT
-- ========================
-- IMPORTANT: You must first create an admin user via Supabase Auth
-- (Dashboard → Authentication → Add User), then run:
--
--   insert into users (id, name, email, role, verified)
--   values ('<auth-user-uuid>', 'Admin', 'admin@karigargo.com', 'admin', true);
--
-- Replace <auth-user-uuid> with the actual UUID from the Auth tab.


-- ========================
-- 11. SIGNUP HELPER RPCs
-- ========================
-- These run as SECURITY DEFINER so the client doesn't need DELETE/UPDATE
-- permissions.  They handle conflicts on BOTH id (PK) and email (UNIQUE)
-- which a single ON CONFLICT clause cannot do.

create or replace function public.handle_signup_user(
  p_id              uuid,
  p_name            text,
  p_email           text,
  p_phone           text     default null,
  p_role            user_role default 'customer',
  p_city            text     default null,
  p_profile_photo_url text   default null,
  p_verified        boolean  default false
) returns void as $$
begin
  -- Remove stale rows where the email matches but the id differs
  -- (leftover from a previous auth user that was deleted / recreated).
  delete from public.users where email = p_email and id != p_id;

  -- Insert the row; if this exact id already exists, do nothing.
  insert into public.users (id, name, email, phone, role, city, profile_photo_url, verified)
  values (p_id, p_name, p_email, p_phone, p_role, p_city, p_profile_photo_url, p_verified)
  on conflict (id) do nothing;
end;
$$ language plpgsql security definer;


-- Completes signup by setting CNIC docs and profile_complete flag.
-- Needed because after supabase.auth.signUp() with email-confirmation ON
-- the session is null, so direct .update() calls fail (RLS: auth.uid() = id).
-- This function runs as SECURITY DEFINER and bypasses RLS.
create or replace function public.handle_complete_signup_profile(
  p_id              uuid,
  p_cnic            text     default null,
  p_cnic_front_url  text     default null,
  p_cnic_back_url   text     default null,
  p_profile_complete boolean default true
) returns void as $$
begin
  update public.users
  set cnic            = coalesce(p_cnic, cnic),
      cnic_front_url  = coalesce(p_cnic_front_url, cnic_front_url),
      cnic_back_url   = coalesce(p_cnic_back_url, cnic_back_url),
      profile_complete = p_profile_complete
  where id = p_id;
end;
$$ language plpgsql security definer;


create or replace function public.handle_signup_worker_profile(
  p_user_id          uuid,
  p_skills           text[],
  p_bio              text     default null,
  p_cnic             text     default null,
  p_cnic_front_url   text     default null,
  p_cnic_back_url    text     default null,
  p_certificate_urls text[]   default null
) returns void as $$
begin
  insert into public.worker_profiles
    (user_id, skills, bio, cnic, cnic_front_url, cnic_back_url,
     certificate_urls, avg_rating, total_jobs, total_earnings)
  values
    (p_user_id, p_skills, p_bio, p_cnic, p_cnic_front_url, p_cnic_back_url,
     p_certificate_urls, 0, 0, 0)
  on conflict (user_id) do nothing;
end;
$$ language plpgsql security definer;


-- ========================
-- 12. REPLICA IDENTITY FULL for worker_locations
-- ========================
-- Without this, Supabase Realtime drops UPDATE events that are filtered
-- on non-primary-key columns (e.g. job_id). Setting REPLICA IDENTITY FULL
-- ensures all column values are included in change payloads.
-- This MUST be run in the Supabase SQL Editor.

alter table worker_locations replica identity full;


-- ========================
-- 12b. ADD WORKER LOCATION COLUMNS TO BIDS
-- ========================
-- Stores the worker's GPS coordinates at the time they submit a bid.
-- Used to show approximate worker distance on bid cards.

alter table bids add column if not exists worker_lat double precision;
alter table bids add column if not exists worker_lng double precision;


-- ========================
-- 12c. ADD CNIC COLUMNS TO USERS TABLE
-- ========================
-- Customers now upload CNIC during signup (same as workers do via worker_profiles).
-- These columns store the CNIC data directly on the users table so both
-- customers and workers can be verified from one place.

alter table users add column if not exists cnic text;
alter table users add column if not exists cnic_front_url text;
alter table users add column if not exists cnic_back_url text;


-- ========================
-- 12d2. PROFILE COMPLETION FLAG
-- ========================
-- false = Google OAuth user who hasn't filled CNIC/city yet.
-- true  = email/password user (filled at signup) or Google user who completed the extra step.
-- ProtectedRoute in the app redirects to /complete-profile/* when this is false.

alter table users add column if not exists profile_complete boolean not null default false;

-- Backfill customers: must have cnic + city (all required fields filled)
update public.users set profile_complete = true
where role = 'customer'
  and cnic      is not null and cnic      != ''
  and city      is not null and city      != '';

-- Backfill workers: must have city + phone in users AND cnic in worker_profiles
update public.users u
set profile_complete = true
from public.worker_profiles wp
where wp.user_id = u.id
  and u.role    = 'worker'
  and u.city    is not null and u.city  != ''
  and u.phone   is not null and u.phone != ''
  and wp.cnic   is not null and wp.cnic != '';


-- ========================
-- 12e. TRIGGER: Sync email verification → users.verified
-- ========================
-- When Supabase Auth confirms an email (user clicks the link, or signs
-- in via Google OAuth), auth.users.email_confirmed_at becomes non-null.
-- This trigger copies that fact into public.users.verified = true so the
-- app's "verified" badge works automatically without admin intervention.

create or replace function public.sync_email_verified()
returns trigger as $$
begin
  if new.email_confirmed_at is not null
     and (old.email_confirmed_at is null or old.email_confirmed_at is distinct from new.email_confirmed_at)
  then
    update public.users set verified = true where id = new.id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

do $$ begin
  create trigger trg_sync_email_verified
    after update on auth.users
    for each row execute function public.sync_email_verified();
exception when duplicate_object then null;
end $$;


-- ========================
-- 13. TRIGGER: Update worker stats on job completion
-- ========================
-- Fires whenever a job's status changes to 'completed'.
-- Recalculates total_jobs and total_earnings (net of platform_fee)
-- directly from the jobs table so the dashboard widget is always accurate.

create or replace function update_worker_stats_on_completion()
returns trigger as $$
begin
  -- Only act when transitioning INTO 'completed'
  if new.status = 'completed' and (old.status is null or old.status != 'completed') and new.worker_id is not null then
    update worker_profiles
    set
      total_jobs = (
        select count(*)
        from jobs
        where worker_id = new.worker_id and status = 'completed'
      ),
      total_earnings = (
        select coalesce(
          sum(
            coalesce(inspection_charges, 0) +
            coalesce(work_cost, 0) -
            coalesce(platform_fee, 0)
          ), 0
        )
        from jobs
        where worker_id = new.worker_id and status = 'completed'
      )
    where user_id = new.worker_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

do $$ begin
  create trigger trg_worker_stats_on_completion
    after update on jobs
    for each row execute function update_worker_stats_on_completion();
exception when duplicate_object then null;
end $$;


-- ========================
-- MIGRATIONS
-- ========================
-- Add city to jobs for location-based worker filtering
alter table jobs add column if not exists city text;

-- ========================
-- DONE ✅
-- ========================
-- Tables created:     9  (users, worker_profiles, jobs, bids, messages, reviews, notifications, worker_locations, reports)
-- Indexes created:   11
-- Triggers created:   8  (2 updated_at + 4 auto-notification + 1 worker_stats + 1 platform_fee)
-- RLS:               MVP (open + user-self-update + admin-only reports)
-- Storage buckets:    4  (avatars, signup-docs, job-images, message-media)
-- Realtime enabled:   4  tables (jobs, messages, notifications, worker_locations)
-- Extra columns:      bids(worker_lat, worker_lng), users(cnic, cnic_front_url, cnic_back_url)
-- ⚠️  BEFORE PRODUCTION: replace open policies with proper per-role RLS!
