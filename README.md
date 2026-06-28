# SpecialPro｜特教導師減壓戰情室

核心目標：老師快速記，系統自動整理。

目前支援兩種模式：

- `demo`：展示模式，只可使用去識別化 mock data，禁止輸入真實學生資料。
- `school_test`：校園安全測試版，必須登入 Supabase Auth，角色由 `profiles.role` 決定。

## 本機啟動

```powershell
npm install
npm run dev
npm run lint
npm run build
```

## 環境變數

複製 `.env.example` 成 `.env.local`：

```powershell
Copy-Item .env.example .env.local
```

```text
VITE_APP_MODE=demo
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-key
```

校園安全測試時改成：

```text
VITE_APP_MODE=school_test
```

## Supabase SQL

`supabase/schema.sql` 是舊版 demo schema，只適合展示，不適合真實校園測試。

校園安全測試版請執行：

```text
supabase/school_safe_schema.sql
```

它會建立：

- `schools`
- `profiles`
- `students`
- `student_sensitive_profiles`
- `student_guardians`
- `student_teacher_access`
- `case_records`
- `iep_goals`
- `assessment_adjustments`
- `support_services`
- `audit_logs`

並啟用 RLS，不建立 anon 全表讀寫 policy。

## 校園安全測試版設定流程

1. 建立 Supabase 專案。
2. 在 SQL Editor 執行 `supabase/school_safe_schema.sql`。
3. 到 Authentication 建立測試帳號。
4. 在 `schools` 建立一所測試學校。
5. 在 `profiles` 為每個 auth user 建立角色資料。
6. 建立測試學生，建議 `display_code` 使用 `王○安`，不要使用完整姓名。
7. 用 `student_teacher_access` 或 `student_guardians` 綁定可存取學生。
8. GitHub Actions Variables 設定：
   - `VITE_APP_MODE=school_test`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## 第一個 Admin Profile

先在 Supabase Authentication 建立一個 admin email 帳號，複製該 user id，然後執行類似：

```sql
insert into public.schools (id, name)
values ('00000000-0000-0000-0000-000000000001', '測試學校')
on conflict do nothing;

insert into public.profiles (id, school_id, role, display_name, is_active)
values (
  '貼上 auth.users.id',
  '00000000-0000-0000-0000-000000000001',
  'admin',
  '系統管理員',
  true
);
```

## 角色

- `special_teacher`：特教導師
- `special_chair`：特教組長
- `homeroom_teacher`：普通班導師
- `subject_teacher`：科任老師
- `parent`：家長
- `admin`：系統管理員

## 權限驗收表

- 未登入：`school_test` 不可看到學生資料，只能看到登入頁。
- 特教導師：可看負責學生完整個案，可新增紀錄、儲存草稿、確認定稿、確認 IEP、匯出。
- 特教組長：可看全校統計與未完成事項。
- 普通班導師：只能看普通班提醒卡、評量調整與授權回饋。
- 科任老師：只能看被授權學生的課堂提醒與評量調整。
- 家長：只能看自己孩子的 parent-safe 內容，不看敏感紀錄。
- 匯出：匯出前必須確認個資提醒，依角色遮蔽。
- PWA：更新後會清舊 cache，前端顯示新版本提示。

## 明確警告

demo 模式不可輸入真實學生資料。

校園安全測試版仍屬內部小範圍測試，請僅輸入測試授權範圍內資料，避免輸入完整身分證字號、完整病歷、非必要醫療資訊或與教學支持無關的敏感內容。

## 目前仍是 Demo / 待正式化項目

- demo 模式仍使用 localStorage 與 mock data。
- school_test 已加 Auth/RLS schema 與前端登入閘門，但完整新增學生後台表單尚未建立。
- 真正 OpenAI API 尚未接入，目前仍是 AI 模擬函式。
- audit log schema 已建立，前端匯出/確認流程仍需進一步接 Supabase insert audit log。
