create extension if not exists pgcrypto;

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  school_id uuid references public.schools(id),
  role text not null check (role in ('special_teacher','special_chair','homeroom_teacher','subject_teacher','parent','admin')),
  display_name text not null,
  class_name text,
  subject_name text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id),
  display_code text not null,
  class_name text not null,
  grade text,
  homeroom_teacher_id uuid references public.profiles(id),
  special_teacher_id uuid references public.profiles(id),
  status text check (status in ('stable','observe','support','urgent')),
  main_needs text[] default '{}',
  iep_focus text[] default '{}',
  support_strategies text[] default '{}',
  regular_class_tips text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.student_sensitive_profiles (
  student_id uuid primary key references public.students(id) on delete cascade,
  disability_category text,
  parent_name text,
  parent_contact text,
  sensitive_notes text,
  medical_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.student_guardians (
  student_id uuid references public.students(id) on delete cascade,
  guardian_id uuid references public.profiles(id) on delete cascade,
  relationship text,
  primary key(student_id, guardian_id)
);

create table if not exists public.student_teacher_access (
  student_id uuid references public.students(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete cascade,
  access_type text check (access_type in ('special','homeroom','subject','viewer')),
  primary key(student_id, teacher_id)
);

create table if not exists public.case_records (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id),
  student_id uuid references public.students(id) on delete cascade,
  record_type text not null,
  raw_text text,
  ai_draft text,
  final_text text,
  antecedent text,
  behavior text,
  intervention text,
  result text,
  follow_up text,
  parent_notified boolean default false,
  usage_tags text[] default '{}',
  status text not null check (status in ('ai_draft','teacher_draft','confirmed','archived')),
  visibility text not null default 'special_only' check (visibility in ('special_only','staff_limited','parent_safe')),
  created_by uuid references public.profiles(id),
  confirmed_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  confirmed_at timestamptz,
  updated_at timestamptz default now()
);

create table if not exists public.iep_goals (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id),
  student_id uuid references public.students(id) on delete cascade,
  domain text,
  current_level text,
  annual_goal text,
  semester_goal text,
  strategies text[],
  evaluation_method text,
  ai_draft jsonb,
  confirmed boolean default false,
  created_by uuid references public.profiles(id),
  confirmed_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  confirmed_at timestamptz,
  updated_at timestamptz default now()
);

create table if not exists public.assessment_adjustments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id),
  student_id uuid references public.students(id) on delete cascade,
  exam_name text,
  extended_time boolean default false,
  read_aloud boolean default false,
  separate_room boolean default false,
  reduced_items boolean default false,
  alternative_assessment boolean default false,
  computer_input boolean default false,
  note text,
  notified_homeroom boolean default false,
  notified_subject_teachers boolean default false,
  notified_academic_office boolean default false,
  post_exam_review text,
  created_by uuid references public.profiles(id),
  updated_at timestamptz default now()
);

create table if not exists public.support_services (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id),
  student_id uuid references public.students(id) on delete cascade,
  service_type text,
  status text,
  start_date date,
  end_date date,
  note text,
  next_follow_up_date date,
  created_by uuid references public.profiles(id),
  updated_at timestamptz default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id),
  actor_id uuid references public.profiles(id),
  action text not null,
  target_table text,
  target_id uuid,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

create or replace function public.current_profile()
returns public.profiles
language sql
security definer
stable
set search_path = public
as $$
  select * from public.profiles where id = auth.uid() and is_active = true limit 1;
$$;

create or replace function public.current_school_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select school_id from public.profiles where id = auth.uid() and is_active = true limit 1;
$$;

create or replace function public.current_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and is_active = true limit 1;
$$;

create or replace function public.get_my_profile()
returns table (
  id uuid,
  school_id uuid,
  role text,
  display_name text,
  class_name text,
  subject_name text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
stable
set search_path = public
set row_security = off
as $$
  select
    p.id,
    p.school_id,
    p.role,
    p.display_name,
    p.class_name,
    p.subject_name,
    p.is_active,
    p.created_at,
    p.updated_at
  from public.profiles p
  where p.id = auth.uid()
  limit 1;
$$;

grant execute on function public.get_my_profile() to authenticated;

create or replace function public.is_school_staff()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.current_role() in ('special_teacher','special_chair','homeroom_teacher','subject_teacher','admin');
$$;

create or replace function public.can_access_student(target_student_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.students s
    where s.id = target_student_id
      and s.school_id = public.current_school_id()
      and (
        public.current_role() in ('admin','special_chair')
        or (public.current_role() = 'special_teacher' and (s.special_teacher_id = auth.uid() or exists (
          select 1 from public.student_teacher_access a where a.student_id = s.id and a.teacher_id = auth.uid() and a.access_type = 'special'
        )))
        or (public.current_role() = 'homeroom_teacher' and (s.homeroom_teacher_id = auth.uid() or exists (
          select 1 from public.student_teacher_access a where a.student_id = s.id and a.teacher_id = auth.uid() and a.access_type = 'homeroom'
        )))
        or (public.current_role() = 'subject_teacher' and exists (
          select 1 from public.student_teacher_access a where a.student_id = s.id and a.teacher_id = auth.uid() and a.access_type in ('subject','viewer')
        ))
        or (public.current_role() = 'parent' and exists (
          select 1 from public.student_guardians g where g.student_id = s.id and g.guardian_id = auth.uid()
        ))
      )
  );
$$;

create or replace function public.can_access_sensitive_student(target_student_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.students s
    where s.id = target_student_id
      and s.school_id = public.current_school_id()
      and (
        public.current_role() in ('admin','special_chair')
        or (public.current_role() = 'special_teacher' and (s.special_teacher_id = auth.uid() or exists (
          select 1 from public.student_teacher_access a where a.student_id = s.id and a.teacher_id = auth.uid() and a.access_type = 'special'
        )))
      )
  );
$$;

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.student_sensitive_profiles enable row level security;
alter table public.student_guardians enable row level security;
alter table public.student_teacher_access enable row level security;
alter table public.case_records enable row level security;
alter table public.iep_goals enable row level security;
alter table public.assessment_adjustments enable row level security;
alter table public.support_services enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "profiles read self and school admins" on public.profiles;
drop policy if exists "profiles admin write" on public.profiles;
create policy "profiles read self and school admins" on public.profiles for select to authenticated using (
  id = auth.uid() or (school_id = public.current_school_id() and public.current_role() in ('admin','special_chair'))
);
create policy "profiles admin write" on public.profiles for all to authenticated using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

drop policy if exists "schools read own" on public.schools;
create policy "schools read own" on public.schools for select to authenticated using (id = public.current_school_id());

drop policy if exists "students select access" on public.students;
drop policy if exists "students write special" on public.students;
drop policy if exists "students delete admin chair" on public.students;
create policy "students select access" on public.students for select to authenticated using (public.can_access_student(id));
create policy "students write special" on public.students for insert to authenticated with check (school_id = public.current_school_id() and public.current_role() in ('special_teacher','special_chair','admin'));
create policy "students update special" on public.students for update to authenticated using (school_id = public.current_school_id() and public.current_role() in ('special_teacher','special_chair','admin')) with check (school_id = public.current_school_id());
create policy "students delete admin chair" on public.students for delete to authenticated using (school_id = public.current_school_id() and public.current_role() in ('special_chair','admin'));

drop policy if exists "sensitive select special only" on public.student_sensitive_profiles;
drop policy if exists "sensitive write special only" on public.student_sensitive_profiles;
create policy "sensitive select special only" on public.student_sensitive_profiles for select to authenticated using (public.can_access_sensitive_student(student_id));
create policy "sensitive write special only" on public.student_sensitive_profiles for all to authenticated using (public.can_access_sensitive_student(student_id) and public.current_role() in ('special_teacher','special_chair','admin')) with check (public.can_access_sensitive_student(student_id));

drop policy if exists "guardian rows visible to staff or self" on public.student_guardians;
drop policy if exists "guardian write special" on public.student_guardians;
create policy "guardian rows visible to staff or self" on public.student_guardians for select to authenticated using (guardian_id = auth.uid() or public.current_role() in ('special_teacher','special_chair','admin'));
create policy "guardian write special" on public.student_guardians for all to authenticated using (public.current_role() in ('special_teacher','special_chair','admin')) with check (public.current_role() in ('special_teacher','special_chair','admin'));

drop policy if exists "teacher access visible to staff" on public.student_teacher_access;
drop policy if exists "teacher access write special" on public.student_teacher_access;
create policy "teacher access visible to staff" on public.student_teacher_access for select to authenticated using (teacher_id = auth.uid() or public.current_role() in ('special_teacher','special_chair','admin'));
create policy "teacher access write special" on public.student_teacher_access for all to authenticated using (public.current_role() in ('special_teacher','special_chair','admin')) with check (public.current_role() in ('special_teacher','special_chair','admin'));

drop policy if exists "case records select by visibility" on public.case_records;
drop policy if exists "case records insert by role" on public.case_records;
drop policy if exists "case records update owner or special" on public.case_records;
drop policy if exists "case records delete chair admin" on public.case_records;
create policy "case records select by visibility" on public.case_records for select to authenticated using (
  school_id = public.current_school_id() and public.can_access_student(student_id) and (
    public.current_role() in ('special_teacher','special_chair','admin')
    or (public.current_role() in ('homeroom_teacher','subject_teacher') and visibility in ('staff_limited','parent_safe'))
    or (public.current_role() = 'parent' and visibility = 'parent_safe')
  )
);
create policy "case records insert by role" on public.case_records for insert to authenticated with check (
  school_id = public.current_school_id() and public.can_access_student(student_id) and (
    public.current_role() in ('special_teacher','special_chair','admin')
    or (public.current_role() in ('homeroom_teacher','subject_teacher') and record_type = '普通班回饋' and visibility = 'staff_limited')
  )
);
create policy "case records update owner or special" on public.case_records for update to authenticated using (
  school_id = public.current_school_id() and ((created_by = auth.uid() and status <> 'confirmed') or public.current_role() in ('special_teacher','special_chair','admin'))
) with check (school_id = public.current_school_id());
create policy "case records delete chair admin" on public.case_records for delete to authenticated using (school_id = public.current_school_id() and public.current_role() in ('special_chair','admin'));

drop policy if exists "iep select staff" on public.iep_goals;
drop policy if exists "iep write special" on public.iep_goals;
drop policy if exists "iep delete admin chair" on public.iep_goals;
create policy "iep select staff" on public.iep_goals for select to authenticated using (school_id = public.current_school_id() and public.can_access_student(student_id) and public.current_role() in ('special_teacher','special_chair','homeroom_teacher','subject_teacher','admin'));
create policy "iep write special" on public.iep_goals for insert to authenticated with check (school_id = public.current_school_id() and public.current_role() in ('special_teacher','special_chair','admin'));
create policy "iep update special" on public.iep_goals for update to authenticated using (school_id = public.current_school_id() and public.current_role() in ('special_teacher','special_chair','admin')) with check (school_id = public.current_school_id());
create policy "iep delete admin chair" on public.iep_goals for delete to authenticated using (school_id = public.current_school_id() and public.current_role() in ('special_chair','admin'));

drop policy if exists "assessment select staff parent limited" on public.assessment_adjustments;
drop policy if exists "assessment write special" on public.assessment_adjustments;
create policy "assessment select staff parent limited" on public.assessment_adjustments for select to authenticated using (school_id = public.current_school_id() and public.can_access_student(student_id));
create policy "assessment write special" on public.assessment_adjustments for all to authenticated using (school_id = public.current_school_id() and public.current_role() in ('special_teacher','special_chair','admin')) with check (school_id = public.current_school_id());

drop policy if exists "support select special" on public.support_services;
drop policy if exists "support write special" on public.support_services;
create policy "support select special" on public.support_services for select to authenticated using (school_id = public.current_school_id() and public.current_role() in ('special_teacher','special_chair','admin'));
create policy "support write special" on public.support_services for all to authenticated using (school_id = public.current_school_id() and public.current_role() in ('special_teacher','special_chair','admin')) with check (school_id = public.current_school_id());

drop policy if exists "audit insert own" on public.audit_logs;
drop policy if exists "audit select scoped" on public.audit_logs;
create policy "audit insert own" on public.audit_logs for insert to authenticated with check (actor_id = auth.uid() and school_id = public.current_school_id());
create policy "audit select scoped" on public.audit_logs for select to authenticated using (
  school_id = public.current_school_id() and (public.current_role() in ('admin','special_chair') or actor_id = auth.uid())
);
