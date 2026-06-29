-- SpecialPro school_test bootstrap
-- Run after creating auth users in Supabase Auth.

insert into public.schools (id, name)
values ('00000000-0000-0000-0000-000000000001', 'SpecialPro 測試學校')
on conflict (id) do nothing;

insert into public.profiles (
  id, school_id, role, display_name, class_name, subject_name, is_active
) values
  (
    'e915a310-cc50-4f37-9f1e-82e12a1cd268',
    '00000000-0000-0000-0000-000000000001',
    'admin',
    '系統管理員',
    null,
    null,
    true
  ),
  (
    'd6092a92-7876-4417-af68-6658f6fde70f',
    '00000000-0000-0000-0000-000000000001',
    'special_teacher',
    '林特教',
    null,
    null,
    true
  ),
  (
    'b973e848-d055-4c78-856c-556c661f4761',
    '00000000-0000-0000-0000-000000000001',
    'homeroom_teacher',
    '陳導師',
    '801班',
    null,
    true
  ),
  (
    'a2c185e1-26fc-4087-b6ee-9d4771bb2a1b',
    '00000000-0000-0000-0000-000000000001',
    'parent',
    '王媽媽',
    null,
    null,
    true
  )
on conflict (id) do update
set
  school_id = excluded.school_id,
  role = excluded.role,
  display_name = excluded.display_name,
  class_name = excluded.class_name,
  subject_name = excluded.subject_name,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.students (
  id, school_id, display_code, class_name, grade,
  homeroom_teacher_id, special_teacher_id, status,
  main_needs, iep_focus, support_strategies, regular_class_tips
) values
  (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000001',
    '王○安',
    '801班',
    '8',
    'b973e848-d055-4c78-856c-556c661f4761',
    'd6092a92-7876-4417-af68-6658f6fde70f',
    'support',
    array['閱讀理解', '情緒調節'],
    array['閱讀重點擷取', '同儕互動界線', '情緒升高時自我調節'],
    array['關鍵字提示', '活動轉換前預告', '冷靜角短暫調節', '任務分段'],
    array['活動轉換前請先預告', '指令一次不要超過兩步', '避免公開責備', '情緒升高時可短暫離座喝水']
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000001',
    '李○庭',
    '702班',
    '7',
    'b973e848-d055-4c78-856c-556c661f4761',
    'd6092a92-7876-4417-af68-6658f6fde70f',
    'observe',
    array['專注力', '作業完成'],
    array['作業拆解', '課堂注意力維持', '每日任務追蹤'],
    array['作業檢核表', '座位靠近教師', '短任務回饋', '完成後立即肯定'],
    array['課前提醒要交的作業', '一次給一項任務', '提供檢核表', '下課前協助確認聯絡簿']
  )
on conflict (id) do nothing;

insert into public.student_sensitive_profiles (
  student_id, disability_category, parent_name, parent_contact, sensitive_notes, medical_notes
) values
  (
    '11111111-1111-1111-1111-111111111111',
    '學習與情緒調節需求',
    '王媽媽',
    'LINE：wang-parent',
    '家庭壓力較高，家長近期照顧負荷增加。',
    null
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '注意力與執行功能需求',
    '李爸爸',
    'LINE：lee-parent',
    '近期睡眠不穩，需避免公開比較。',
    null
  )
on conflict (student_id) do update
set
  disability_category = excluded.disability_category,
  parent_name = excluded.parent_name,
  parent_contact = excluded.parent_contact,
  sensitive_notes = excluded.sensitive_notes,
  medical_notes = excluded.medical_notes,
  updated_at = now();

insert into public.student_teacher_access (student_id, teacher_id, access_type) values
  ('11111111-1111-1111-1111-111111111111', 'd6092a92-7876-4417-af68-6658f6fde70f', 'special'),
  ('11111111-1111-1111-1111-111111111111', 'b973e848-d055-4c78-856c-556c661f4761', 'homeroom'),
  ('22222222-2222-2222-2222-222222222222', 'd6092a92-7876-4417-af68-6658f6fde70f', 'special'),
  ('22222222-2222-2222-2222-222222222222', 'b973e848-d055-4c78-856c-556c661f4761', 'homeroom')
on conflict (student_id, teacher_id) do update
set access_type = excluded.access_type;

insert into public.student_guardians (student_id, guardian_id, relationship) values
  ('11111111-1111-1111-1111-111111111111', 'a2c185e1-26fc-4087-b6ee-9d4771bb2a1b', '母親')
on conflict (student_id, guardian_id) do update
set relationship = excluded.relationship;
