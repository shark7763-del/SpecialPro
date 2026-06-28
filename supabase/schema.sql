create table if not exists public.students (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.records (
  id text primary key,
  student_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.assessment_adjustments (
  student_id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.sync_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_role text not null,
  action text not null,
  target_type text not null,
  target_id text not null,
  created_at timestamptz not null default now()
);

alter table public.students enable row level security;
alter table public.records enable row level security;
alter table public.assessment_adjustments enable row level security;
alter table public.sync_audit_logs enable row level security;

drop policy if exists "demo read students" on public.students;
drop policy if exists "demo write students" on public.students;
drop policy if exists "demo update students" on public.students;
drop policy if exists "demo read records" on public.records;
drop policy if exists "demo write records" on public.records;
drop policy if exists "demo update records" on public.records;
drop policy if exists "demo read assessment adjustments" on public.assessment_adjustments;
drop policy if exists "demo write assessment adjustments" on public.assessment_adjustments;
drop policy if exists "demo update assessment adjustments" on public.assessment_adjustments;
drop policy if exists "demo write audit logs" on public.sync_audit_logs;

create policy "demo read students" on public.students for select to anon using (true);
create policy "demo write students" on public.students for insert to anon with check (true);
create policy "demo update students" on public.students for update to anon using (true) with check (true);

create policy "demo read records" on public.records for select to anon using (true);
create policy "demo write records" on public.records for insert to anon with check (true);
create policy "demo update records" on public.records for update to anon using (true) with check (true);

create policy "demo read assessment adjustments" on public.assessment_adjustments for select to anon using (true);
create policy "demo write assessment adjustments" on public.assessment_adjustments for insert to anon with check (true);
create policy "demo update assessment adjustments" on public.assessment_adjustments for update to anon using (true) with check (true);

create policy "demo write audit logs" on public.sync_audit_logs for insert to anon with check (true);
