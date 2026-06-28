# SpecialPro｜特教導師減壓戰情室

特教行政減量 MVP：老師快速記，系統自動整理。

## 本機啟動

```powershell
npm install
npm run dev
```

## 驗證

```powershell
npm run build
npm run lint
```

## GitHub Pages

目前使用 GitHub Actions 部署到：

https://shark7763-del.github.io/SpecialPro/

每次推送到 `main` branch 會自動部署。

## Supabase 後台同步設定

第一階段同步已支援：

- `students`
- `records`
- `assessment_adjustments`
- `sync_audit_logs`

### 1. 建立 Supabase 專案

到 Supabase 建立新專案，進入 SQL Editor。

### 2. 建立資料表

把 `supabase/schema.sql` 的內容貼到 SQL Editor 執行。

目前 schema 是 demo 版 RLS policy，允許 anon 讀寫，方便 MVP 測試。正式上線前要改成登入帳號與角色權限。

### 3. 設定環境變數

複製 `.env.example` 成 `.env.local`：

```powershell
Copy-Item .env.example .env.local
```

填入：

```text
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

Supabase client 使用 `@supabase/supabase-js`，瀏覽器端只放 publishable / anon key，不要放 service role key。

### 4. GitHub Pages 設定 Secrets

到 GitHub repo：

`Settings > Secrets and variables > Actions > Variables`

新增：

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

或改 workflow 使用 repository variables 後重新部署。

### 5. 使用同步

App 上方會顯示「後台同步」：

- `上傳後台`：把目前 localStorage 資料上傳 Supabase
- `下載後台`：從 Supabase 下載資料覆蓋本機 localStorage

## 下一階段

- 加 Supabase Auth 真登入
- 建 `profiles` 表管理角色
- 將 demo RLS 改為角色權限
- 加 Realtime 即時同步
- 將 AI 模擬改為 Edge Function 呼叫 OpenAI API
