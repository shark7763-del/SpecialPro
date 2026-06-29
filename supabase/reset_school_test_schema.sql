-- SpecialPro school_test reset
-- Use this only on a fresh test database or when you want to replace the old demo schema.

drop table if exists public.audit_logs cascade;
drop table if exists public.support_services cascade;
drop table if exists public.assessment_adjustments cascade;
drop table if exists public.iep_goals cascade;
drop table if exists public.case_records cascade;
drop table if exists public.student_teacher_access cascade;
drop table if exists public.student_guardians cascade;
drop table if exists public.student_sensitive_profiles cascade;
drop table if exists public.students cascade;
drop table if exists public.profiles cascade;
drop table if exists public.schools cascade;

drop table if exists public.sync_audit_logs cascade;
drop table if exists public.records cascade;

drop function if exists public.get_my_profile();
drop function if exists public.current_profile();
drop function if exists public.current_school_id();
drop function if exists public.current_role();
drop function if exists public.is_school_staff();
drop function if exists public.can_access_student(uuid);
drop function if exists public.can_access_sensitive_student(uuid);

-- After running this reset, execute:
-- 1. supabase/school_safe_schema.sql
-- 2. supabase/bootstrap_school_test_full.sql
