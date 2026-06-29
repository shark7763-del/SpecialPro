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
8. 如果要啟用名單管理功能，再執行 `supabase/roster_management_migration.sql`。
9. GitHub Actions Variables 設定：
   - `VITE_APP_MODE=school_test`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## 名單管理流程

1. 先用 `admin` 或 `special_chair` 登入。
2. 到首頁點 `名單管理`。
3. 在「學生名單」新增學生，優先用 `display_code`，不要輸入完整姓名與完整敏感資料。
4. 在「教職員 / 家長帳號」先到 Supabase Authentication 建帳號，再回來建立 profile。
5. 在「學生授權綁定」把學生綁給特教導師、普通班導師、科任老師與家長。
6. 在「CSV 批次匯入」先預覽，再確認匯入。

## CSV 匯入欄位

```text
student_display_code, grade, class_name, seat_no, main_need, support_level, special_teacher_email, homeroom_teacher_email, subject_teacher_emails, parent_emails
```

注意：

- `subject_teacher_emails` 與 `parent_emails` 可用 `;` 或 `,` 分隔多個 email。
- 匯入前會先檢查 email 是否已有 profile。
- 如果學生已存在，系統會標示錯誤，不會直接匯入。

## 帳號建立流程

### 手動模式

1. 到 Supabase Authentication 建立 email 帳號。
2. 回到 SpecialPro 後台建立 profile。
3. profile 建立後再做學生綁定。

### 邀請模式

- 目前保留 TODO，未來可接 Supabase Edge Function 做邀請建立帳號。

## 綁定流程

- `special_teacher` / `homeroom_teacher` / `subject_teacher` 會寫入 `student_teacher_access`。
- `parent` 會寫入 `student_guardians`。
- 解除綁定不刪資料，改為 `is_active = false`。

## 測試資料注意事項

- 校園測試版只使用測試資料。
- 建議使用 `王○安` 這類 `display_code`。
- 不要輸入完整姓名、身分證字號、完整病歷、完整醫療診斷或非必要敏感資料。

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

更方便的做法是直接用這份範本：

- [supabase/bootstrap_school_test.sql](./supabase/bootstrap_school_test.sql)

如果你要一次把登入函式、學校、帳號、學生、IEP、評量調整與紀錄全補齊，直接跑：

- [supabase/bootstrap_school_test_full.sql](./supabase/bootstrap_school_test_full.sql)

如果你要直接擴增一批學生名單，直接跑：

- [supabase/sample_student_list_10.sql](./supabase/sample_student_list_10.sql)

如果你已經有既有資料庫，只想補名單管理欄位與權限，直接跑：

- [supabase/roster_management_migration.sql](./supabase/roster_management_migration.sql)

如果資料庫裡還留著舊 demo 表結構，先跑：

- [supabase/reset_school_test_schema.sql](./supabase/reset_school_test_schema.sql)

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
- 名單管理：`admin` / `special_chair` 可建立學生、profile、授權綁定與 CSV 匯入。
- 妥善率檢查：`admin` / `special_chair` 可查看校園小範圍測試前的安全檢查結果。

## 目前已完成

- 名單管理。
- 學生名單。
- profile 建立。
- 學生授權綁定。
- CSV 批次匯入。
- 妥善率檢查頁。
- 今日待辦。
- 30 秒快速記。
- IEP 流程化頁面（`IEPWorkflowPage`）。
- parent-safe 與 staff-limited 顯示。

## 仍是 Demo / TODO

- 真正 OpenAI API 尚未接入，目前仍是 AI 模擬函式。
- PDF 正式匯出尚未完成，目前以可列印 HTML / 文字匯出為主。
- Edge Function 邀請帳號尚未完成。
- RLS 實際攻防測試仍需使用 Supabase 測試帳號逐項驗證。
- `demo` 模式仍使用 localStorage 與 mock data。
- 匯出 audit log 目前會記錄 `export_case_package`、`export_iep_package`、`export_parent_safe_package`、`export_transition_package`、`export_teacher_tip_card`、`export_assessment_adjustment`。

## 明確警告

demo 模式不可輸入真實學生資料。

校園安全測試版仍屬內部小範圍測試，請僅輸入測試授權範圍內資料，避免輸入完整身分證字號、完整病歷、非必要醫療資訊或與教學支持無關的敏感內容。

## 小範圍校園測試前檢查清單

1. 已用 `school_test` 模式登入。
2. `profiles.role` 已正確建立。
3. `students` 與授權關聯已建立。
4. `audit_logs` 可寫入。
5. 家長端只顯示 parent-safe 內容。
6. 普通班導師與科任老師看不到完整敏感紀錄。
7. CSV 匯入已先預覽，且沒有錯誤。
8. 匯出前已完成個資提醒確認。
9. IEP 已走草稿、編輯、確認流程。
10. 名單資料僅使用去識別化測試內容。

## 測試角色建議帳號

- `admin`
- `special_chair`
- `special_teacher`
- `homeroom_teacher`
- `subject_teacher`
- `parent`

## 目前仍是 Demo / 待正式化項目

- demo 模式仍使用 localStorage 與 mock data。
- `school_test` 已有 Auth/RLS schema、登入閘門、名單管理、今日待辦、妥善率檢查與 parent-safe 顯示，但仍屬內部測試版。
- 真正 OpenAI API 尚未接入，目前仍是 AI 模擬函式。
- audit log 已經串接登入、查看個案、草稿定稿、教師回饋、匯出等主要流程，但仍建議在正式上線前再做完整稽核與權限壓測。

## 目前可直接參考的相容檔

- `src/lib/supabase.ts`
- `src/services/supabaseService.ts`
- `src/types.ts`

這三個檔案是為了相容既有檢查與引用路徑所加的轉接檔，不是新的資料來源。
