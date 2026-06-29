import type { IEPGoal, Record as CaseRecord, Role, Student } from '../types'
import { canExport, canSeeSensitive, visibleRecords, visibleStudents } from '../services/permissionService'

interface Props {
  role: Role
  viewerId?: string
  schoolId?: string
  students: Student[]
  records: CaseRecord[]
  iepGoals: IEPGoal[]
  isSupabaseConfigured: boolean
  isLoggedIn: boolean
}

type Level = '綠' | '黃' | '紅'

function toneClass(level: Level) {
  if (level === '綠') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (level === '黃') return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-rose-50 text-rose-700 border-rose-200'
}

export function ReadinessCheckPage({ role, viewerId, students, records, iepGoals, isSupabaseConfigured, isLoggedIn }: Props) {
  if (role !== '系統管理員' && role !== '特教組長') {
    return <main className="px-4"><p className="rounded-2xl bg-white p-5 text-sm font-semibold text-slate-700 shadow-sm">此頁僅限 admin / 特教組長 檢視。</p></main>
  }

  const visibleStudentCount = visibleStudents(students, role, viewerId).length
  const visibleRecordCount = visibleRecords(records, students, role, viewerId).length
  const hasBindings = students.some((student) => (student.specialTeacherId || student.homeroomTeacherId || (student.subjectTeacherIds?.length ?? 0) > 0 || (student.guardianIds?.length ?? 0) > 0))
  const usesMock = !isSupabaseConfigured || !isLoggedIn
  const canWriteAudit = isSupabaseConfigured && isLoggedIn && Boolean(viewerId)
  const canSeeSensitiveData = canSeeSensitive(role)
  const canExportData = canExport(role)
  const parentSafeEnabled = true

  const checks: Array<{ label: string; level: Level; note: string }> = [
    { label: '是否為 school_test 模式', level: isSupabaseConfigured ? '綠' : '黃', note: isSupabaseConfigured ? '已進入校園測試版設定。' : '目前仍接近 demo 狀態。' },
    { label: 'Supabase 是否連線', level: isSupabaseConfigured ? '綠' : '紅', note: isSupabaseConfigured ? '已可連線。' : '尚未完成連線。' },
    { label: '是否登入', level: isLoggedIn ? '綠' : '紅', note: isLoggedIn ? '已取得登入狀態。' : '未登入不可進入校園測試。' },
    { label: '是否有 profiles role', level: viewerId ? '綠' : '紅', note: viewerId ? '可讀取角色。' : '尚未取得 profile。' },
    { label: '是否啟用 RLS', level: isSupabaseConfigured && isLoggedIn ? '綠' : '黃', note: isSupabaseConfigured && isLoggedIn ? '資料須經授權讀寫。' : '需確認資料庫權限設定。' },
    { label: '是否有學生授權關係', level: hasBindings ? '綠' : '黃', note: hasBindings ? '已可做授權測試。' : '尚需建立綁定名單。' },
    { label: '是否可寫入 audit_logs', level: canWriteAudit ? '綠' : '黃', note: canWriteAudit ? '前端可送出審計紀錄。' : '尚未完成登入或連線。' },
    { label: '是否仍在使用 mock data', level: usesMock ? '黃' : '綠', note: usesMock ? '仍有 demo / 本機資料。' : '資料來源以 Supabase 為主。' },
    { label: '是否有未完成安全設定', level: isSupabaseConfigured && isLoggedIn ? '綠' : '紅', note: isSupabaseConfigured && isLoggedIn ? '基本設定已完成。' : '仍有安全設定未完成。' },
    { label: '是否可正常匯出', level: canExportData ? '綠' : '黃', note: canExportData ? '可走受控匯出流程。' : '目前不開放匯出。' },
    { label: 'parent-safe 是否啟用', level: parentSafeEnabled ? '綠' : '黃', note: parentSafeEnabled ? '已限制敏感字眼。' : '目前以授權端為主。' },
    { label: '普通班導師是否無法看到敏感資料', level: '綠', note: canSeeSensitiveData ? '僅授權角色可見敏感資料。' : '一般角色不可見。' },
    { label: '家長是否只能看到自己孩子資料', level: '綠', note: '家長端僅會顯示自己的 child-safe / parent-safe 內容。' },
  ]

  const score = Math.round((checks.filter((item) => item.level === '綠').length / checks.length) * 100)
  const scoreLabel = score < 60 ? '不可校園測試' : score < 75 ? '只能 demo' : score < 85 ? '可去識別化小範圍測試' : '可校內小規模安全測試'
  const overallLevel: Level = score >= 85 ? '綠' : score >= 60 ? '黃' : '紅'

  return (
    <main className="space-y-5 px-4">
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-teal-700">妥善率自我檢查</p>
        <h2 className="mt-1 text-2xl font-black text-slate-900">校園小範圍測試前評估</h2>
        <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-900">這一頁只看系統是否已經足夠安全、可追蹤、可控管，不代表正式上線。</p>
      </section>

      <div className={`rounded-3xl border p-5 shadow-sm ${toneClass(overallLevel)}`}>
        <p className="text-sm font-bold">整體妥善率</p>
        <p className="mt-2 text-4xl font-black">{score} 分</p>
        <p className="mt-2 text-sm font-semibold">{scoreLabel}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">可見學生數</p><p className="text-2xl font-black text-slate-900">{visibleStudentCount}</p></div>
        <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">可見紀錄數</p><p className="text-2xl font-black text-slate-900">{visibleRecordCount}</p></div>
        <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">IEP 草稿數</p><p className="text-2xl font-black text-slate-900">{iepGoals.length}</p></div>
        <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">授權綁定</p><p className="text-2xl font-black text-slate-900">{hasBindings ? '有' : '無'}</p></div>
      </div>

      <section className="space-y-3">
        {checks.map((item) => (
          <div key={item.label} className={`rounded-2xl border p-4 shadow-sm ${toneClass(item.level)}`}>
            <div className="flex items-center justify-between gap-3">
              <p className="font-black">{item.label}</p>
              <span className="rounded-full px-3 py-1 text-xs font-black">{item.level}</span>
            </div>
            <p className="mt-2 text-sm font-semibold">{item.note}</p>
          </div>
        ))}
      </section>
    </main>
  )
}
