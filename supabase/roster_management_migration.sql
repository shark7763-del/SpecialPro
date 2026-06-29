-- SpecialPro roster management migration
-- Run this on an existing school_safe_schema database.

alter table public.profiles add column if not exists email text unique;
alter table public.students add column if not exists seat_no text;
alter table public.students add column if not exists main_need text;
alter table public.students add column if not exists support_level text;
alter table public.students add column if not exists roster_status text default 'active';
alter table public.student_guardians add column if not exists is_active boolean default true;
alter table public.student_teacher_access add column if not exists is_active boolean default true;

alter table public.students drop constraint if exists students_roster_status_check;
alter table public.students add constraint students_roster_status_check check (roster_status in ('active','inactive','graduated','transferred'));

create or replace function public.lookup_auth_user_id_by_email(input_email text)
returns uuid
language sql
security definer
stable
set search_path = public, auth
set row_security = off
as $$
  select id from auth.users where lower(email) = lower(input_email) limit 1;
$$;

grant execute on function public.lookup_auth_user_id_by_email(text) to authenticated;

drop policy if exists "profiles admin write" on public.profiles;
create policy "profiles admin write" on public.profiles for all to authenticated using (public.current_role() in ('admin','special_chair')) with check (public.current_role() in ('admin','special_chair'));

drop policy if exists "students write special" on public.students;
drop policy if exists "students update special" on public.students;
create policy "students write special" on public.students for insert to authenticated with check (school_id = public.current_school_id() and public.current_role() in ('special_teacher','special_chair','admin'));
create policy "students update special" on public.students for update to authenticated using (school_id = public.current_school_id() and public.current_role() in ('special_teacher','special_chair','admin')) with check (school_id = public.current_school_id() and public.current_role() in ('special_teacher','special_chair','admin'));

drop policy if exists "guardian write special" on public.student_guardians;
create policy "guardian write special" on public.student_guardians for all to authenticated using (public.current_role() in ('special_teacher','special_chair','admin')) with check (public.current_role() in ('special_teacher','special_chair','admin'));

drop policy if exists "teacher access write special" on public.student_teacher_access;
create policy "teacher access write special" on public.student_teacher_access for all to authenticated using (public.current_role() in ('special_teacher','special_chair','admin')) with check (public.current_role() in ('special_teacher','special_chair','admin'));
