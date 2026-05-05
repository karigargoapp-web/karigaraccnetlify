do $$ begin
  create type approval_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type wallet_tx_type as enum (
    'top_up','inspection_payment','escrow_lock','escrow_release',
    'commission','reward','bidding_fee','refund','withdrawal','partial_refund'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type escrow_status as enum (
    'inspection_held','work_held','released','refunded','partial_refund'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type dispute_status as enum ('open','resolved','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type dispute_resolution as enum ('continue','partial','cancel');
exception when duplicate_object then null; end $$;

do $$ begin
  alter type job_status add value if not exists 'inProgress';
exception when others then null; end $$;
do $$ begin
  alter type job_status add value if not exists 'paused';
exception when others then null; end $$;
do $$ begin
  alter type job_status add value if not exists 'disputed';
exception when others then null; end $$;

alter table users
  add column if not exists approval_status approval_status not null default 'pending',
  add column if not exists rejection_reason text,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_reason text,
  add column if not exists dispute_count integer not null default 0,
  add column if not exists cancellation_count integer not null default 0;

update users set approval_status = 'approved' where verified = true and role = 'customer';
update users set approval_status = 'approved' where verified = true and role = 'worker';
update users set approval_status = 'approved' where role = 'admin';

alter table worker_profiles
  add column if not exists cnic_verified_by text default 'manual',
  add column if not exists approval_reviewed_by uuid references users(id) on delete set null,
  add column if not exists approval_reviewed_at timestamptz;

alter table jobs
  add column if not exists cancellation_reason text,
  add column if not exists cancelled_by uuid references users(id) on delete set null,
  add column if not exists admin_note text,
  add column if not exists paused_at timestamptz,
  add column if not exists work_cost_total integer,
  add column if not exists dispute_id uuid;

alter table bids
  drop constraint if exists bids_inspection_charges_check;
alter table bids
  add constraint bids_inspection_charges_check check (inspection_charges <= 500);

create table if not exists wallets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  reward_points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists wallet_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references users(id) on delete cascade,
  type wallet_tx_type not null,
  amount integer not null,
  direction text not null check (direction in ('credit','debit')),
  job_id uuid references jobs(id) on delete set null,
  description text not null default '',
  balance_after integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists escrow (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null unique references jobs(id) on delete cascade,
  inspection_amount integer not null default 0,
  work_amount integer not null default 0,
  total_locked integer not null default 0,
  status escrow_status not null default 'inspection_held',
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists disputes (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references jobs(id) on delete cascade,
  raised_by uuid not null references users(id) on delete cascade,
  reason text not null,
  status dispute_status not null default 'open',
  resolution_type dispute_resolution,
  settled_amount integer,
  admin_notes text,
  resolved_by uuid references users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_actions (
  id uuid primary key default uuid_generate_v4(),
  admin_id uuid not null references users(id) on delete cascade,
  action_type text not null,
  entity_type text not null,
  entity_id text not null,
  entity_name text not null default '',
  notes text,
  metadata jsonb,
  created_at timestamptz not null default now()
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
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_escrow_updated_at
    before update on escrow
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_disputes_updated_at
    before update on disputes
    for each row execute function update_updated_at();
exception when duplicate_object then null; end $$;

create or replace function get_or_create_wallet(p_user_id uuid)
returns uuid as $$
declare
  v_wallet_id uuid;
begin
  select id into v_wallet_id from wallets where user_id = p_user_id;
  if not found then
    insert into wallets (user_id) values (p_user_id) returning id into v_wallet_id;
  end if;
  return v_wallet_id;
end;
$$ language plpgsql security definer;

create or replace function fn_wallet_debit(
  p_user_id uuid,
  p_amount integer,
  p_type wallet_tx_type,
  p_job_id uuid default null,
  p_description text default ''
) returns void as $$
declare
  v_balance integer;
begin
  perform get_or_create_wallet(p_user_id);
  select balance into v_balance from wallets where user_id = p_user_id for update;
  if v_balance < p_amount then
    raise exception 'Insufficient wallet balance';
  end if;
  update wallets set balance = balance - p_amount where user_id = p_user_id;
  insert into wallet_transactions (user_id, type, amount, direction, job_id, description, balance_after)
  values (p_user_id, p_type, p_amount, 'debit', p_job_id, p_description, v_balance - p_amount);
end;
$$ language plpgsql security definer;

create or replace function fn_wallet_credit(
  p_user_id uuid,
  p_amount integer,
  p_type wallet_tx_type,
  p_job_id uuid default null,
  p_description text default ''
) returns void as $$
declare
  v_balance integer;
begin
  perform get_or_create_wallet(p_user_id);
  select balance into v_balance from wallets where user_id = p_user_id for update;
  update wallets set balance = balance + p_amount where user_id = p_user_id;
  insert into wallet_transactions (user_id, type, amount, direction, job_id, description, balance_after)
  values (p_user_id, p_type, p_amount, 'credit', p_job_id, p_description, v_balance + p_amount);
end;
$$ language plpgsql security definer;

create or replace function fn_wallet_reward(
  p_user_id uuid,
  p_points integer,
  p_job_id uuid default null,
  p_description text default ''
) returns void as $$
begin
  perform get_or_create_wallet(p_user_id);
  update wallets set reward_points = reward_points + p_points where user_id = p_user_id;
  insert into wallet_transactions (user_id, type, amount, direction, job_id, description, balance_after)
  select p_user_id, 'reward', p_points, 'credit', p_job_id, p_description, reward_points
  from wallets where user_id = p_user_id;
end;
$$ language plpgsql security definer;

create or replace function fn_lock_inspection_escrow(p_job_id uuid, p_customer_id uuid, p_inspection_amount integer)
returns void as $$
begin
  perform fn_wallet_debit(p_customer_id, p_inspection_amount, 'inspection_payment', p_job_id, 'Inspection fee locked');
  insert into escrow (job_id, inspection_amount, total_locked, status)
  values (p_job_id, p_inspection_amount, p_inspection_amount, 'inspection_held')
  on conflict (job_id) do update
    set inspection_amount = p_inspection_amount, total_locked = p_inspection_amount, status = 'inspection_held';
end;
$$ language plpgsql security definer;

create or replace function fn_settle_inspection_only(p_job_id uuid, p_worker_id uuid)
returns void as $$
declare
  v_inspection integer;
  v_commission integer;
  v_worker_net integer;
  v_customer_id uuid;
  v_platform_wallet uuid;
begin
  select inspection_amount into v_inspection from escrow where job_id = p_job_id;
  select customer_id into v_customer_id from jobs where id = p_job_id;
  v_commission := round(v_inspection * 0.10);
  v_worker_net := v_inspection - v_commission;
  select id into v_platform_wallet from wallets where user_id = (select id from users where role = 'admin' limit 1);
  perform fn_wallet_credit(p_worker_id, v_worker_net, 'escrow_release', p_job_id, 'Inspection payment received');
  perform fn_wallet_reward(v_customer_id, round(v_inspection * 0.02), p_job_id, 'Inspection reward points');
  update escrow set status = 'released', released_at = now() where job_id = p_job_id;
  update jobs set
    platform_fee = v_commission,
    work_cost_total = v_inspection,
    status = 'completed',
    completed_at = now()
  where id = p_job_id;
end;
$$ language plpgsql security definer;

create or replace function fn_lock_work_escrow(p_job_id uuid, p_customer_id uuid, p_worker_id uuid, p_work_total integer)
returns void as $$
declare
  v_inspection integer;
  v_work_only integer;
begin
  select inspection_amount into v_inspection from escrow where job_id = p_job_id;
  v_work_only := p_work_total - v_inspection;
  perform fn_wallet_debit(p_customer_id, v_work_only, 'escrow_lock', p_job_id, 'Work cost locked in escrow');
  perform fn_wallet_debit(p_worker_id, 20, 'bidding_fee', p_job_id, 'Bidding fee');
  update escrow
    set work_amount = v_work_only, total_locked = p_work_total, status = 'work_held'
  where job_id = p_job_id;
  update jobs set work_cost_total = p_work_total, status = 'inProgress' where id = p_job_id;
end;
$$ language plpgsql security definer;

create or replace function fn_complete_job(p_job_id uuid)
returns void as $$
declare
  v_total integer;
  v_commission integer;
  v_worker_net integer;
  v_reward integer;
  v_worker_id uuid;
  v_customer_id uuid;
begin
  select work_cost_total, worker_id, customer_id into v_total, v_worker_id, v_customer_id
  from jobs where id = p_job_id;
  v_commission := round(v_total * 0.10);
  v_worker_net := v_total - v_commission;
  v_reward := round(v_total * 0.02);
  perform fn_wallet_credit(v_worker_id, v_worker_net, 'escrow_release', p_job_id, 'Job payment received');
  perform fn_wallet_reward(v_customer_id, v_reward, p_job_id, 'Job completion reward');
  perform fn_wallet_reward(v_worker_id, v_reward, p_job_id, 'Job completion reward');
  update escrow set status = 'released', released_at = now() where job_id = p_job_id;
  update jobs set
    platform_fee = v_commission,
    status = 'completed',
    completed_at = now()
  where id = p_job_id;
end;
$$ language plpgsql security definer;

create or replace function fn_dispute_settle(
  p_job_id uuid,
  p_resolution dispute_resolution,
  p_settled_amount integer,
  p_admin_id uuid,
  p_notes text default ''
) returns void as $$
declare
  v_total integer;
  v_commission integer;
  v_worker_net integer;
  v_refund integer;
  v_worker_id uuid;
  v_customer_id uuid;
  v_dispute_id uuid;
begin
  select work_cost_total, worker_id, customer_id into v_total, v_worker_id, v_customer_id
  from jobs where id = p_job_id;
  select id into v_dispute_id from disputes where job_id = p_job_id and status = 'open' limit 1;

  if p_resolution = 'continue' then
    update jobs set status = 'inProgress', paused_at = null where id = p_job_id;
  elsif p_resolution = 'partial' then
    v_commission := round(p_settled_amount * 0.10);
    v_worker_net := p_settled_amount - v_commission;
    v_refund := v_total - p_settled_amount;
    perform fn_wallet_credit(v_worker_id, v_worker_net, 'partial_refund', p_job_id, 'Partial settlement');
    if v_refund > 0 then
      perform fn_wallet_credit(v_customer_id, v_refund, 'refund', p_job_id, 'Partial refund from dispute');
    end if;
    update escrow set status = 'partial_refund', released_at = now() where job_id = p_job_id;
    update jobs set status = 'completed', platform_fee = v_commission, completed_at = now() where id = p_job_id;
  elsif p_resolution = 'cancel' then
    perform fn_wallet_credit(v_customer_id, v_total, 'refund', p_job_id, 'Full refund from dispute cancellation');
    update escrow set status = 'refunded', released_at = now() where job_id = p_job_id;
    update jobs set status = 'cancelled' where id = p_job_id;
  end if;

  update disputes set
    status = 'resolved',
    resolution_type = p_resolution,
    settled_amount = p_settled_amount,
    admin_notes = p_notes,
    resolved_by = p_admin_id,
    resolved_at = now()
  where id = v_dispute_id;

  insert into admin_actions (admin_id, action_type, entity_type, entity_id, entity_name, notes)
  values (p_admin_id, 'dispute_resolve', 'job', p_job_id::text, 'Dispute #' || v_dispute_id, p_notes);
end;
$$ language plpgsql security definer;

create or replace function fn_approve_worker(p_worker_id uuid, p_admin_id uuid)
returns void as $$
begin
  update users set approval_status = 'approved', verified = true, rejection_reason = null
  where id = p_worker_id;
  update worker_profiles set approval_reviewed_by = p_admin_id, approval_reviewed_at = now()
  where user_id = p_worker_id;
  perform create_notification(p_worker_id, 'system', 'Account approved ✅',
    'Your account has been approved. You can now start bidding on jobs.', null);
  insert into admin_actions (admin_id, action_type, entity_type, entity_id, entity_name)
  select p_admin_id, 'worker_approve', 'user', p_worker_id::text, name from users where id = p_worker_id;
end;
$$ language plpgsql security definer;

create or replace function fn_reject_worker(p_worker_id uuid, p_admin_id uuid, p_reason text)
returns void as $$
begin
  update users set approval_status = 'rejected', rejection_reason = p_reason where id = p_worker_id;
  update worker_profiles set approval_reviewed_by = p_admin_id, approval_reviewed_at = now()
  where user_id = p_worker_id;
  perform create_notification(p_worker_id, 'system', 'Account not approved',
    'Your account was not approved. Reason: ' || p_reason, null);
  insert into admin_actions (admin_id, action_type, entity_type, entity_id, entity_name, notes)
  select p_admin_id, 'worker_reject', 'user', p_worker_id::text, name, p_reason from users where id = p_worker_id;
end;
$$ language plpgsql security definer;

create or replace function fn_suspend_user(p_user_id uuid, p_admin_id uuid, p_reason text)
returns void as $$
begin
  update users set suspended_at = now(), suspension_reason = p_reason where id = p_user_id;
  perform create_notification(p_user_id, 'system', 'Account suspended',
    'Your account has been suspended. Reason: ' || p_reason, null);
  insert into admin_actions (admin_id, action_type, entity_type, entity_id, entity_name, notes)
  select p_admin_id, 'user_suspend', 'user', p_user_id::text, name, p_reason from users where id = p_user_id;
end;
$$ language plpgsql security definer;

create or replace function fn_unsuspend_user(p_user_id uuid, p_admin_id uuid)
returns void as $$
begin
  update users set suspended_at = null, suspension_reason = null where id = p_user_id;
  insert into admin_actions (admin_id, action_type, entity_type, entity_id, entity_name)
  select p_admin_id, 'user_unsuspend', 'user', p_user_id::text, name from users where id = p_user_id;
end;
$$ language plpgsql security definer;

alter table wallets enable row level security;
alter table wallet_transactions enable row level security;
alter table escrow enable row level security;
alter table disputes enable row level security;
alter table admin_actions enable row level security;

create policy "users_own_wallet" on wallets for select using (auth.uid() = user_id);
create policy "admin_all_wallets" on wallets for all using (
  exists (select 1 from users where id = auth.uid() and role = 'admin')
);

create policy "users_own_tx" on wallet_transactions for select using (auth.uid() = user_id);
create policy "admin_all_tx" on wallet_transactions for all using (
  exists (select 1 from users where id = auth.uid() and role = 'admin')
);

create policy "job_parties_escrow" on escrow for select using (
  exists (select 1 from jobs where id = job_id and (customer_id = auth.uid() or worker_id = auth.uid()))
);
create policy "admin_all_escrow" on escrow for all using (
  exists (select 1 from users where id = auth.uid() and role = 'admin')
);

create policy "job_parties_disputes" on disputes for select using (
  auth.uid() = raised_by or
  exists (select 1 from jobs where id = job_id and (customer_id = auth.uid() or worker_id = auth.uid()))
);
create policy "users_insert_dispute" on disputes for insert with check (auth.uid() = raised_by);
create policy "admin_all_disputes" on disputes for all using (
  exists (select 1 from users where id = auth.uid() and role = 'admin')
);

create policy "admin_all_admin_actions" on admin_actions for all using (
  exists (select 1 from users where id = auth.uid() and role = 'admin')
);

alter table realtime.messages enable row level security;

do $$ begin
  alter publication supabase_realtime add table escrow;
exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table disputes;
exception when others then null; end $$;
do $$ begin
  alter publication supabase_realtime add table wallets;
exception when others then null; end $$;
