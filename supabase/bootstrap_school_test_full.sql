-- SpecialPro school_test one-shot bootstrap
-- Run after creating auth users in Supabase Auth.
-- This script creates the profile lookup RPC, seeds the school, users, students, and sample records.

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

insert into public.schools (id, name)
values ('00000000-0000-0000-0000-000000000001', 'SpecialPro 測試學校')
on conflict (id) do nothing;

insert into public.profiles (
  id, school_id, email, role, display_name, class_name, subject_name, is_active
) values
  ('e915a310-cc50-4f37-9f1e-82e12a1cd268', '00000000-0000-0000-0000-000000000001', 'admin@specialpro.test', 'admin', '系統管理員', null, null, true),
  ('d6092a92-7876-4417-af68-6658f6fde70f', '00000000-0000-0000-0000-000000000001', 'teacher@specialpro.test', 'special_teacher', '林特教', null, null, true),
  ('b973e848-d055-4c78-856c-556c661f4761', '00000000-0000-0000-0000-000000000001', 'homeroom@specialpro.test', 'homeroom_teacher', '陳導師', '801班', null, true),
  ('a2c185e1-26fc-4087-b6ee-9d4771bb2a1b', '00000000-0000-0000-0000-000000000001', 'parent@specialpro.test', 'parent', '王媽媽', null, null, true)
on conflict (id) do update set
  school_id = excluded.school_id,
  email = excluded.email,
  role = excluded.role,
  display_name = excluded.display_name,
  class_name = excluded.class_name,
  subject_name = excluded.subject_name,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.students (
  id, school_id, display_code, class_name, grade, seat_no, main_need, support_level, roster_status,
  homeroom_teacher_id, special_teacher_id, status,
  main_needs, iep_focus, support_strategies, regular_class_tips
) values
  (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000001',
    '王○安',
    '801班',
    '8',
    '21',
    '閱讀理解',
    '中度支持',
    'active',
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
    '16',
    '專注力',
    '一般支持',
    'active',
    'b973e848-d055-4c78-856c-556c661f4761',
    'd6092a92-7876-4417-af68-6658f6fde70f',
    'observe',
    array['專注力', '作業完成'],
    array['作業拆解', '課堂注意力維持', '每日任務追蹤'],
    array['作業檢核表', '座位靠近教師', '短任務回饋', '完成後立即肯定'],
    array['課前提醒要交的作業', '一次給一項任務', '提供檢核表', '下課前協助確認聯絡簿']
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    '00000000-0000-0000-0000-000000000001',
    '陳○恩',
    '603班',
    '6',
    '08',
    '社交支持',
    '高度支持',
    'active',
    'b973e848-d055-4c78-856c-556c661f4761',
    'd6092a92-7876-4417-af68-6658f6fde70f',
    'support',
    array['同儕互動', '活動轉換'],
    array['輪流等待', '轉換提示', '團體活動參與'],
    array['視覺流程卡', '預告轉換', '同儕示範', '短句提醒'],
    array['轉換前先口頭預告', '團體活動先分角色', '使用簡短明確指令', '避免一次要求太多']
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    '00000000-0000-0000-0000-000000000001',
    '林○宇',
    '504班',
    '5',
    '14',
    '數學支持',
    '一般支持',
    'active',
    'b973e848-d055-4c78-856c-556c661f4761',
    'd6092a92-7876-4417-af68-6658f6fde70f',
    'stable',
    array['數學應用', '指令理解'],
    array['生活情境題', '口語指令理解'],
    array['圖示輔助', '分步驟解題', '重點圈選'],
    array['題目先讀一次', '口語提示搭配圖示', '提供計算步驟卡', '確認是否理解題意']
  ),
  (
    '55555555-5555-5555-5555-555555555555',
    '00000000-0000-0000-0000-000000000001',
    '張○晴',
    '901班',
    '9',
    '11',
    '考試支持',
    '中度支持',
    'active',
    'b973e848-d055-4c78-856c-556c661f4761',
    'd6092a92-7876-4417-af68-6658f6fde70f',
    'observe',
    array['考試焦慮', '學習策略'],
    array['考前準備', '時間管理', '自我檢核'],
    array['考前預告', '延長作答時間', '考前安定提示'],
    array['考前提醒重點範圍', '分段完成', '先易後難', '考後給具體回饋']
  )
on conflict (id) do update set
  school_id = excluded.school_id,
  seat_no = excluded.seat_no,
  main_need = excluded.main_need,
  support_level = excluded.support_level,
  roster_status = excluded.roster_status,
  display_code = excluded.display_code,
  class_name = excluded.class_name,
  grade = excluded.grade,
  homeroom_teacher_id = excluded.homeroom_teacher_id,
  special_teacher_id = excluded.special_teacher_id,
  status = excluded.status,
  main_needs = excluded.main_needs,
  iep_focus = excluded.iep_focus,
  support_strategies = excluded.support_strategies,
  regular_class_tips = excluded.regular_class_tips,
  updated_at = now();

insert into public.student_sensitive_profiles (
  student_id, disability_category, parent_name, parent_contact, sensitive_notes, medical_notes
) values
  ('11111111-1111-1111-1111-111111111111', '學習與情緒調節需求', '王媽媽', 'LINE：wang-parent', '家庭壓力較高，家長近期照顧負荷增加。', null),
  ('22222222-2222-2222-2222-222222222222', '注意力與執行功能需求', '李爸爸', 'LINE：lee-parent', '近期睡眠不穩，需避免公開比較。', null),
  ('33333333-3333-3333-3333-333333333333', '社交互動與轉換支持需求', '陳爸爸', 'LINE：chen-parent', '在團體活動切換時較容易焦躁。', null),
  ('44444444-4444-4444-4444-444444444444', '學習支持需求', '林媽媽', 'LINE：lin-parent', '家中支持穩定，配合學校建議。', null),
  ('55555555-5555-5555-5555-555555555555', '考試壓力與學習策略支持需求', '張媽媽', 'LINE：chang-parent', '考前焦慮較高，需要溫和提醒。', null)
on conflict (student_id) do update set
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
  ('22222222-2222-2222-2222-222222222222', 'b973e848-d055-4c78-856c-556c661f4761', 'homeroom'),
  ('33333333-3333-3333-3333-333333333333', 'd6092a92-7876-4417-af68-6658f6fde70f', 'special'),
  ('33333333-3333-3333-3333-333333333333', 'b973e848-d055-4c78-856c-556c661f4761', 'homeroom'),
  ('44444444-4444-4444-4444-444444444444', 'd6092a92-7876-4417-af68-6658f6fde70f', 'special'),
  ('44444444-4444-4444-4444-444444444444', 'b973e848-d055-4c78-856c-556c661f4761', 'homeroom'),
  ('55555555-5555-5555-5555-555555555555', 'd6092a92-7876-4417-af68-6658f6fde70f', 'special'),
  ('55555555-5555-5555-5555-555555555555', 'b973e848-d055-4c78-856c-556c661f4761', 'homeroom')
on conflict (student_id, teacher_id) do update
set access_type = excluded.access_type, is_active = true;

insert into public.student_guardians (student_id, guardian_id, relationship) values
  ('11111111-1111-1111-1111-111111111111', 'a2c185e1-26fc-4087-b6ee-9d4771bb2a1b', '母親')
on conflict (student_id, guardian_id) do update
set relationship = excluded.relationship, is_active = true;

insert into public.iep_goals (
  id, school_id, student_id, domain, current_level, annual_goal, semester_goal,
  strategies, evaluation_method, ai_draft, confirmed, created_by, confirmed_by
) values
  (
    '66666666-6666-6666-6666-666666666666',
    '00000000-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    '閱讀理解',
    '短文閱讀後可在提示下找出主要訊息。',
    '在教師提供關鍵字提示下，能閱讀短文並回答文章內容相關問題，正確率達 80%。',
    '能在段落重點標示下完成 3 題理解題。',
    array['關鍵字提示', '分段閱讀', '重點標示', '口語回饋'],
    '口語問答與分段評量',
    '{"source":"seed","note":"AI 草稿，需由老師確認。"}'::jsonb,
    true,
    'd6092a92-7876-4417-af68-6658f6fde70f',
    'd6092a92-7876-4417-af68-6658f6fde70f'
  )
on conflict (id) do update set
  school_id = excluded.school_id,
  student_id = excluded.student_id,
  domain = excluded.domain,
  current_level = excluded.current_level,
  annual_goal = excluded.annual_goal,
  semester_goal = excluded.semester_goal,
  strategies = excluded.strategies,
  evaluation_method = excluded.evaluation_method,
  ai_draft = excluded.ai_draft,
  confirmed = excluded.confirmed,
  created_by = excluded.created_by,
  confirmed_by = excluded.confirmed_by,
  updated_at = now();

insert into public.assessment_adjustments (
  id, school_id, student_id, exam_name, extended_time, read_aloud, separate_room,
  reduced_items, alternative_assessment, computer_input, note,
  notified_homeroom, notified_subject_teachers, notified_academic_office, post_exam_review, created_by
) values
  (
    '77777777-7777-7777-7777-777777777777',
    '00000000-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    '第一次段考',
    true,
    false,
    true,
    false,
    false,
    false,
    '可延長 20 分鐘，安排獨立考場。',
    true,
    true,
    true,
    null,
    'd6092a92-7876-4417-af68-6658f6fde70f'
  )
on conflict (id) do update set
  school_id = excluded.school_id,
  student_id = excluded.student_id,
  exam_name = excluded.exam_name,
  extended_time = excluded.extended_time,
  read_aloud = excluded.read_aloud,
  separate_room = excluded.separate_room,
  reduced_items = excluded.reduced_items,
  alternative_assessment = excluded.alternative_assessment,
  computer_input = excluded.computer_input,
  note = excluded.note,
  notified_homeroom = excluded.notified_homeroom,
  notified_subject_teachers = excluded.notified_subject_teachers,
  notified_academic_office = excluded.notified_academic_office,
  post_exam_review = excluded.post_exam_review,
  created_by = excluded.created_by,
  updated_at = now();

insert into public.support_services (
  id, school_id, student_id, service_type, status, start_date, end_date, note, next_follow_up_date, created_by
) values
  (
    '88888888-8888-8888-8888-888888888888',
    '00000000-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    '資源班支持',
    '進行中',
    current_date,
    null,
    '每週二進行閱讀與情緒調節支持。',
    current_date + 14,
    'd6092a92-7876-4417-af68-6658f6fde70f'
  )
on conflict (id) do update set
  school_id = excluded.school_id,
  student_id = excluded.student_id,
  service_type = excluded.service_type,
  status = excluded.status,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  note = excluded.note,
  next_follow_up_date = excluded.next_follow_up_date,
  created_by = excluded.created_by,
  updated_at = now();

insert into public.case_records (
  id, school_id, student_id, record_type, raw_text, ai_draft, final_text,
  antecedent, behavior, intervention, result, follow_up, parent_notified,
  usage_tags, status, visibility, created_by, confirmed_by
) values
  (
    '99999999-9999-9999-9999-999999999999',
    '00000000-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    '情緒行為',
    '第三節同學碰到鉛筆盒，小安大叫，帶到資源班冷靜後已通知家長。',
    'AI 草稿，需由老師確認後才會定稿。',
    '學生於第三節課因同儕碰觸個人物品產生情緒反應，出現大聲表達不滿之情形。教師先協助學生離開刺激情境，並至資源班進行情緒安撫。學生後續情緒逐漸穩定，已通知家長。後續將持續觀察學生面對同儕互動及物品界線時之情緒調節情形。',
    '同儕碰觸個人物品',
    '大聲表達不滿',
    '帶離刺激環境並安撫',
    '情緒穩定',
    '持續觀察同儕互動',
    true,
    array['IEP檢討','家長溝通','情緒行為追蹤'],
    'confirmed',
    'special_only',
    'd6092a92-7876-4417-af68-6658f6fde70f',
    'd6092a92-7876-4417-af68-6658f6fde70f'
  )
on conflict (id) do update set
  school_id = excluded.school_id,
  student_id = excluded.student_id,
  record_type = excluded.record_type,
  raw_text = excluded.raw_text,
  ai_draft = excluded.ai_draft,
  final_text = excluded.final_text,
  antecedent = excluded.antecedent,
  behavior = excluded.behavior,
  intervention = excluded.intervention,
  result = excluded.result,
  follow_up = excluded.follow_up,
  parent_notified = excluded.parent_notified,
  usage_tags = excluded.usage_tags,
  status = excluded.status,
  visibility = excluded.visibility,
  created_by = excluded.created_by,
  confirmed_by = excluded.confirmed_by,
  confirmed_at = now(),
  updated_at = now();
