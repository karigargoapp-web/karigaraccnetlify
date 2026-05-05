do $$ begin
  create type approval_status as enum ('pending','approved','rejected');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type wallet_tx_type as enum (
    'top_up','inspection_payment','escrow_lock','escrow_release',
    'commission','reward','bidding_fee','refund','partial_refund','withdrawal'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type escrow_status as enum (
    'inspection_held','work_held','released','refunded','partial_refund'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type dispute_status as enum ('open','resolved','cancelled');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type dispute_resolution as enum ('continue','partial','cancel');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type cancellation_actor as enum ('customer','worker','admin');
exception when duplicate_object then null;
end $$;

alter table users
  add column if not exists approval_status approval_status not null default 'pending',
  add column if not exists rejection_reason text,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_reason text,
  add column if not exists dispute_count integer not null default 0,
  add column if not exists cancellation_count integer not null default 0;

update users set approval_status = 'approved' where role = 'customer';
update users set approval_status = 'approved' where verified = true;

alter table worker_profiles
  add column if not exists cnic_verified_by text default 'manual',
  add column if not exists approval_reviewed_by uuid references users(id) on delete set null,
  add column if not exists approval_reviewed_at timestamptz;

do $$ begin
  alter table jobs add column if not exists cancellation_reason text;
  alter table jobs add column if not exists cancelled_by uuid references users(id) on delete set null;
  alter table jobs add column if not exists cancellation_actor cancellation_actor;
  alter table jobs add column if not exists admin_note text;
  alter table jobs add column if not exists paused_at timestamptz;
  alter table jobs add column if not exists work_cost_total integer;
  alter table jobs add column if not exists dispute_id uuid;
exception when others then null;
end $$;

alter table bids
  drop constraint if exists bids_inspection_charges_check;

alter table bids
  add constraint bids_inspection_charges_check check (inspection_charges <= 500);

create table if not exists wallets (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null unique references users(id) on delete cascade,
  balance       integer not null default 0 check (balance >= 0),
  reward_points integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists wallet_transactions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references users(id) on delete cascade,
  type        wallet_tx_type not null,
  amount      integer not null,
  direction   text not null check (direction in ('credit','debit')),
  job_id      uuid references jobs(id) on delete set null,
  description text not null default '',
  created_at  timestamptz not null default now()
);

create table if not exists escrow (
  id                 uuid primary key default uuid_generate_v4(),
  job_id             uuid not null unique references jobs(id) on delete cascade,
  inspection_amount  integer not null default 0,
  work_amount        integer not null default 0,
  total_locked       integer not null default 0,
  status             escrow_status not null default 'inspection_held',
  released_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists disputes (
  id              uuid primary key default uuid_generate_v4(),
  job_id          uuid not null references jobs(id) on delete cascade,
  raised_by       uuid not null references users(id) on delete cascade,
  reason          text not null,
  status          dispute_status not null default 'open',
  resolution_type dispute_resolution,
  settled_amount  integer,
  admin_notes     text,
  resolved_by     uuid references users(id) on delete set null,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);

create table if not exists admin_actions (
  id          uuid primary key default uuid_generate_v4(),
  admin_id    uuid not null references users(id) on delete cascade,
  action_type text not null,
  entity_type text not null,
  entity_id   text not null,
  notes       text,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_wallets_user on wallets(user_id);
create index if not exists idx_wallet_tx_user on wallet_transactions(user_id, created_at desc);
create index if not exists idx_wallet_tx_job on wallet_transactions(job_id);
create index if not exists idx_escrow_job on escrow(job_id);
create index if not exists idx_disputes_job on disputes(job_id);
create index if not exists idx_disputes_status on disputes(status);
create index if not exists idx_admin_actions_admin on admin_actions(admin_id, created_at desc);
create index if not exists idx_users_approval on users(approval_status) where role = 'worker';

do $$ begin
  create trigger trg_wallets_updated_at
    before update on wallets
    for each row execute function update_updated_at();
exception when duplicate_object then null;
end $$;

do $$ begin
  create trigger trg_escrow_updated_at
    before update on escrow
    for each row execute function update_updated_at();
exception when duplicate_object then null;
end $$;

create or replace function create_wallet_for_new_user()
returns trigger as $$
begin
  insert into wallets (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

do $$ begin
  create trigger trg_create_wallet
    after insert on users
    for each row execute function create_wallet_for_new_user();
exception when duplicate_object then null;
end $$;

insert into wallets (user_id)
select id from users
where id not in (select user_id from wallets)
on conflict (user_id) do nothing;

create or replace function fn_lock_inspection_escrow(p_job_id uuid, p_customer_id uuid, p_amount integer)
returns void as $$
declare
  v_balance integer;
begin
  select balance into v_balance from wallets where user_id = p_customer_id for update;
  if v_balance < p_amount then
    raise exception 'insufficient_balance';
  end if;
  update wallets set balance = balance - p_amount where user_id = p_customer_id;
  insert into wallet_transactions (user_id, type, amount, direction, job_id, description)
  values (p_customer_id, 'inspection_payment', p_amount, 'debit', p_job_id, 'Inspection fee payment');
  insert into escrow (job_id, inspection_amount, total_locked, status)
  values (p_job_id, p_amount, p_amount, 'inspection_held')
  on conflict (job_id) do update set inspection_amount = p_amount, total_locked = p_amount, status = 'inspection_held';
end;
$$ language plpgsql security definer;

create or replace function fn_settle_inspection_only(p_job_id uuid)
returns void as $$
declare
  v_job record;
  v_escrow record;
  v_commission integer;
  v_worker_gets integer;
  v_reward_points integer;
begin
  select * into v_job from jobs where id = p_job_id;
  select * into v_escrow from escrow where job_id = p_job_id;
  v_commission := round(v_escrow.inspection_amount * 0.10);
  v_worker_gets := v_escrow.inspection_amount - v_commission;
  v_reward_points := round(v_escrow.inspection_amount * 0.02);
  update wallets set balance = balance + v_worker_gets where user_id = v_job.worker_id;
  insert into wallet_transactions (user_id, type, amount, direction, job_id, description)
  values (v_job.worker_id, 'escrow_release', v_worker_gets, 'credit', p_job_id, 'Inspection fee (after 10% commission)');
  update wallets set reward_points = reward_points + v_reward_points where user_id = v_job.customer_id;
  insert into wallet_transactions (user_id, type, amount, direction, job_id, description)
  values (v_job.customer_id, 'reward', v_reward_points, 'credit', p_job_id, '2% reward points for inspection');
  update escrow set status = 'released', released_at = now(), total_locked = 0 where job_id = p_job_id;
  update jobs set
    platform_fee = v_commission,
    inspection_charges = v_escrow.inspection_amount,
    completed_at = now()
  where id = p_job_id;
end;
$$ language plpgsql security definer;

create or replace function fn_lock_work_escrow(p_job_id uuid, p_customer_id uuid, p_worker_id uuid, p_work_amount integer)
returns void as $$
declare
  v_balance integer;
  v_worker_balance integer;
  v_total integer;
  v_inspection integer;
begin
  select inspection_amount into v_inspection from escrow where job_id = p_job_id;
  v_total := v_inspection + p_work_amount;
  select balance into v_balance from wallets where user_id = p_customer_id for update;
  if v_balance < p_work_amount then
    raise exception 'insufficient_balance';
  end if;
  select balance into v_worker_balance from wallets where user_id = p_worker_id for update;
  if v_worker_balance < 20 then
    raise exception 'worker_insufficient_balance';
  end if;
  update wallets set balance = balance - p_work_amount where user_id = p_customer_id;
  insert into wallet_transactions (user_id, type, amount, direction, job_id, description)
  values (p_customer_id, 'escrow_lock', p_work_amount, 'debit', p_job_id, 'Work cost locked in escrow');
  update wallets set balance = balance - 20 where user_id = p_worker_id;
  insert into wallet_transactions (user_id, type, amount, direction, job_id, description)
  values (p_worker_id, 'bidding_fee', 20, 'debit', p_job_id, 'Job start fee');
  update escrow set
    work_amount = p_work_amount,
    total_locked = v_inspection + p_work_amount,
    status = 'work_held'
  where job_id = p_job_id;
  update jobs set work_cost_total = v_total where id = p_job_id;
end;
$$ language plpgsql security definer;

create or replace function fn_complete_job(p_job_id uuid)
returns void as $$
declare
  v_job record;
  v_escrow record;
  v_total integer;
  v_commission integer;
  v_worker_gets integer;
  v_reward integer;
begin
  select * into v_job from jobs where id = p_job_id;
  select * into v_escrow from escrow where job_id = p_job_id;
  v_total := v_escrow.total_locked;
  v_commission := round(v_total * 0.10);
  v_worker_gets := v_total - v_commission;
  v_reward := round(v_total * 0.02);
  update wallets set balance = balance + v_worker_gets where user_id = v_job.worker_id;
  insert into wallet_transactions (user_id, type, amount, direction, job_id, description)
  values (v_job.worker_id, 'escrow_release', v_worker_gets, 'credit', p_job_id, 'Job payment (after 10% commission)');
  update wallets set reward_points = reward_points + v_reward where user_id = v_job.customer_id;
  insert into wallet_transactions (user_id, type, amount, direction, job_id, description)
  values (v_job.customer_id, 'reward', v_reward, 'credit', p_job_id, '2% completion reward');
  update wallets set reward_points = reward_points + v_reward where user_id = v_job.worker_id;
  insert into wallet_transactions (user_id, type, amount, direction, job_id, description)
  values (v_job.worker_id, 'reward', v_reward, 'credit', p_job_id, '2% completion reward');
  update escrow set status = 'released', released_at = now(), total_locked = 0 where job_id = p_job_id;
  update jobs set
    platform_fee = v_commission,
    work_cost_total = v_total,
    completed_at = now()
  where id = p_job_id;
end;
$$ language plpgsql security definer;

create or replace function fn_dispute_settle(p_job_id uuid, p_settled_amount integer, p_resolution dispute_resolution, p_admin_id uuid, p_notes text)
returns void as $$
declare
  v_job record;
  v_escrow record;
  v_commission integer;
  v_worker_gets integer;
  v_refund integer;
begin
  select * into v_job from jobs where id = p_job_id;
  select * into v_escrow from escrow where job_id = p_job_id;
  if p_resolution = 'cancel' then
    update wallets set balance = balance + v_escrow.total_locked where user_id = v_job.customer_id;
    insert into wallet_transactions (user_id, type, amount, direction, job_id, description)
    values (v_job.customer_id, 'refund', v_escrow.total_locked, 'credit', p_job_id, 'Full refund - job cancelled');
    update escrow set status = 'refunded', released_at = now(), total_locked = 0 where job_id = p_job_id;
  elsif p_resolution = 'partial' then
    v_commission := round(p_settled_amount * 0.10);
    v_worker_gets := p_settled_amount - v_commission;
    v_refund := v_escrow.total_locked - p_settled_amount;
    update wallets set balance = balance + v_worker_gets where user_id = v_job.worker_id;
    insert into wallet_transactions (user_id, type, amount, direction, job_id, description)
    values (v_job.worker_id, 'escrow_release', v_worker_gets, 'credit', p_job_id, 'Partial settlement (after commission)');
    if v_refund > 0 then
      update wallets set balance = balance + v_refund where user_id = v_job.customer_id;
      insert into wallet_transactions (user_id, type, amount, direction, job_id, description)
      values (v_job.customer_id, 'partial_refund', v_refund, 'credit', p_job_id, 'Partial refund after dispute');
    end if;
    update escrow set status = 'partial_refund', released_at = now(), total_locked = 0 where job_id = p_job_id;
    update jobs set platform_fee = v_commission where id = p_job_id;
  end if;
  update disputes set
    status = 'resolved',
    resolution_type = p_resolution,
    settled_amount = p_settled_amount,
    admin_notes = p_notes,
    resolved_by = p_admin_id,
    resolved_at = now()
  where job_id = p_job_id and status = 'open';
  insert into admin_actions (admin_id, action_type, entity_type, entity_id, notes)
  values (p_admin_id, 'dispute_resolved', 'job', p_job_id::text, p_notes);
end;
$$ language plpgsql security definer;

alter table wallets enable row level security;
alter table wallet_transactions enable row level security;
alter table escrow enable row level security;
alter table disputes enable row level security;
alter table admin_actions enable row level security;

create policy "users_own_wallet" on wallets for all using (auth.uid() = user_id);
create policy "admin_all_wallets" on wallets for all using (exists (select 1 from users where id = auth.uid() and role = 'admin'));
create policy "users_own_transactions" on wallet_transactions for select using (auth.uid() = user_id);
create policy "admin_all_transactions" on wallet_transactions for all using (exists (select 1 from users where id = auth.uid() and role = 'admin'));
create policy "job_parties_escrow" on escrow for select using (
  exists (select 1 from jobs where id = job_id and (customer_id = auth.uid() or worker_id = auth.uid()))
);
create policy "admin_all_escrow" on escrow for all using (exists (select 1 from users where id = auth.uid() and role = 'admin'));
create policy "job_parties_disputes" on disputes for all using (
  auth.uid() = raised_by or
  exists (select 1 from jobs where id = job_id and (customer_id = auth.uid() or worker_id = auth.uid())) or
  exists (select 1 from users where id = auth.uid() and role = 'admin')
);
create policy "admin_only_actions" on admin_actions for all using (exists (select 1 from users where id = auth.uid() and role = 'admin'));

alter table reports disable row level security;
