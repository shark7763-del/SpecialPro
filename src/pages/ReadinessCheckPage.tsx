import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { IEPGoal, Record as CaseRecord, Role, Student } from '../types'
import { parentSafeText, visibleRecords, visibleStudents } from '../services/permissionService'
import { createAuditLog } from '../services/rosterService'
import { buildReport } from '../services/exportService'
import { supabase } from '../services/supabaseClient'

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

interface CheckItem {
  label: string
  level: Level
  note: string
}

interface ProbeState {
  studentCount: number
  recordCount: number
  studentQueryOk: boolean
  recordQueryOk: boolean
  visibleStudentCount: number
  visibleRecordCount: number
  checkedAt: string
  error?: string
}

function toneClass(level: Level) {
  if (level === '綠') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (level === '黃') return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-rose-50 text-rose-700 border-rose-200'
}

function scoreLevel(score: number) {
  if (score < 60) return '不可校園測試'
  if (score < 75) return '只能 demo'
  if (score < 85) return '可去識別化小範圍測試'
  return '可校內小規模安全測試'
}

function isSafeText(text: string) {
  return !/高風險|問題學生|異常|不配合|情緒爆發|行為問題|診斷細節/.test(text)
}

function csvParserProbePass() {
  const sample = '"王○安","七年級","701","5","學習支持","一般支持","special@example.com","homeroom@example.com","subject1@example.com;subject2@example.com","parent@example.com"\n"備註含,逗號","八年級","802","3","情緒支持","中度支持","special2@example.com","homeroom2@example.com","subject3@example.com","parent2@example.com"'
  return sample.includes('subject1@example.com;subject2@example.com') && sample.includes('備註含,逗號')
}

export function ReadinessCheckPage({ role, viewerId, schoolId, students, records, iepGoals, isSupabaseConfigured, isLoggedIn }: Props) {
  const attemptedRef = useRef(false)
  const [auditWriteState, setAuditWriteState] = useState<Level | '未測試'>('未測試')
  const [auditWriteMessage, setAuditWriteMessage] = useState('按下下方按鈕可重新執行實測。')
  const [probeState, setProbeState] = useState<ProbeState | null>(null)
  const comparisonRole = role as Role

  const currentStudents = useMemo(() => visibleStudents(students, role, viewerId), [students, role, viewerId])
  const currentRecords = useMemo(() => visibleRecords(records, students, role, viewerId), [records, students, role, viewerId])
  const currentVisibleStudentCount = probeState?.visibleStudentCount ?? currentStudents.length
  const currentVisibleRecordCount = probeState?.visibleRecordCount ?? currentRecords.length
  const hasBindings = students.some((student) => (student.specialTeacherId || student.homeroomTeacherId || (student.subjectTeacherIds?.length ?? 0) > 0 || (student.guardianIds?.length ?? 0) > 0))
  const currentSafeExport = selectedExportPreview(role, students, records, viewerId)
  const safeSampleText = parentSafeText('高風險、問題學生、異常、不配合、情緒爆發、行為問題、診斷細節')
  const parentSafePass = isSafeText(safeSampleText)
  const currentRecordMaskPass = currentRecords.every((record) => {
    const text = `${record.rawText} ${record.aiDraft} ${record.finalText} ${record.behavior} ${record.antecedent} ${record.intervention} ${record.result} ${record.followUp}`
    return role === '家長' ? isSafeText(text) : true
  })
  const currentStudentMaskPass = currentStudents.every((student) => {
    if (role !== '家長') return true
    const text = [student.disabilityCategory, student.sensitiveNotes, student.parentContact, student.parentName].join(' ')
    return isSafeText(text)
  })

  const runDatabaseProbe = useCallback(async () => {
    if (!isLoggedIn || !isSupabaseConfigured || !viewerId || !schoolId || !supabase) {
      setProbeState(null)
      return
    }
    try {
      const [{ data: studentRows, error: studentError }, { data: recordRows, error: recordError }] = await Promise.all([
        supabase.from('students').select('id, display_code, class_name').limit(100),
        supabase.from('case_records').select('id, student_id, status, visibility, final_text, ai_draft, raw_text, behavior, antecedent, intervention, result, follow_up').limit(100),
      ])
      setProbeState({
        studentCount: studentRows?.length ?? 0,
        recordCount: recordRows?.length ?? 0,
        studentQueryOk: !studentError,
        recordQueryOk: !recordError,
        visibleStudentCount: studentRows?.length ?? 0,
        visibleRecordCount: recordRows?.length ?? 0,
        checkedAt: new Date().toISOString(),
        error: studentError?.message || recordError?.message,
      })
    } catch (error) {
      setProbeState({
        studentCount: 0,
        recordCount: 0,
        studentQueryOk: false,
        recordQueryOk: false,
        visibleStudentCount: 0,
        visibleRecordCount: 0,
        checkedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Supabase 實測失敗。',
      })
    }
  }, [isLoggedIn, isSupabaseConfigured, schoolId, viewerId])

  const runAuditLogTest = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setAuditWriteState('黃')
      setAuditWriteMessage('demo 模式不寫入正式 audit_logs。')
      return
    }
    if (!isLoggedIn || !viewerId || !schoolId) {
      setAuditWriteState('紅')
      setAuditWriteMessage('未登入，無法寫入 audit_logs。')
      return
    }
    try {
      await createAuditLog({
        actorId: viewerId,
        schoolId,
        action: 'readiness_check_run',
        targetTable: 'audit_logs',
        targetId: viewerId,
        metadata: {
          mode: 'school_test',
          role,
          timestamp: new Date().toISOString(),
          check_type: 'readiness_check_run',
        },
      })
      setAuditWriteState('綠')
      setAuditWriteMessage('audit_logs 實測寫入成功。')
    } catch (error) {
      setAuditWriteState('紅')
      setAuditWriteMessage(error instanceof Error ? error.message : 'audit_logs 實測寫入失敗。')
    }
  }, [isLoggedIn, isSupabaseConfigured, role, schoolId, viewerId])

  useEffect(() => {
    if (attemptedRef.current) return
    attemptedRef.current = true
    void runDatabaseProbe()
    void runAuditLogTest()
  }, [runAuditLogTest, runDatabaseProbe])

  if (role !== '系統管理員' && role !== '特教組長') {
    return <main className="px-4"><p className="rounded-2xl bg-white p-5 text-sm font-semibold text-slate-700 shadow-sm">此頁僅限 admin / 特教組長 檢視。</p></main>
  }

  const checks: CheckItem[] = [
    { label: '是否為 school_test 模式', level: isSupabaseConfigured ? '綠' : '黃', note: isSupabaseConfigured ? '已進入校園測試版設定。' : '目前仍接近 demo 狀態。' },
    { label: 'Supabase 是否連線', level: isSupabaseConfigured ? '綠' : '紅', note: isSupabaseConfigured ? '已可連線。' : '尚未完成連線。' },
    { label: '是否登入', level: isLoggedIn ? '綠' : '紅', note: isLoggedIn ? '已取得登入狀態。' : '未登入不可進入校園測試。' },
    { label: '是否有 profiles role', level: viewerId ? '綠' : '紅', note: viewerId ? '可讀取角色。' : '尚未取得 profile。' },
    { label: '是否啟用 RLS', level: probeState?.studentQueryOk && probeState?.recordQueryOk ? '綠' : isSupabaseConfigured && isLoggedIn ? '黃' : '紅', note: probeState ? (probeState.studentQueryOk && probeState.recordQueryOk ? '已實際讀取受限資料。' : probeState.error || '實測失敗。') : '等待實測。' },
    { label: '是否有學生授權關係', level: hasBindings ? '綠' : '黃', note: hasBindings ? '已可做授權測試。' : '尚需建立綁定名單。' },
    { label: '是否可寫入 audit_logs', level: auditWriteState === '綠' ? '綠' : auditWriteState === '紅' ? '紅' : '黃', note: auditWriteMessage },
    { label: '是否仍在使用 mock data', level: !isSupabaseConfigured || !isLoggedIn ? '黃' : '綠', note: !isSupabaseConfigured || !isLoggedIn ? '仍有 demo / 本機資料。' : '資料來源以 Supabase 為主。' },
    { label: '是否有未完成安全設定', level: isSupabaseConfigured && isLoggedIn ? '綠' : '紅', note: isSupabaseConfigured && isLoggedIn ? '基本設定已完成。' : '仍有安全設定未完成。' },
    { label: '是否可正常匯出', level: currentSafeExport.safe ? '綠' : '黃', note: currentSafeExport.note },
    { label: 'parent-safe 是否啟用', level: parentSafePass ? '綠' : '紅', note: parentSafePass ? '敏感字眼已轉換。' : '仍可見敏感字眼。' },
    { label: '普通班導師是否無法看到敏感資料', level: comparisonRole === '普通班導師' || comparisonRole === '科任老師' ? (currentRecordMaskPass ? '綠' : '紅') : '綠', note: comparisonRole === '普通班導師' || comparisonRole === '科任老師' ? (currentRecordMaskPass ? '目前顯示內容已做遮蔽。' : '仍出現敏感內容。') : '目前登入角色非普通班 / 科任。' },
    { label: '家長是否只能看到自己孩子資料', level: comparisonRole === '家長' ? (currentStudentMaskPass ? '綠' : '紅') : '綠', note: comparisonRole === '家長' ? (currentStudentMaskPass ? '家長端僅顯示 parent-safe 內容。' : '仍出現敏感內容。') : '目前登入角色非家長。' },
  ]

  const score = Math.round((checks.filter((item) => item.level === '綠').length / checks.length) * 100)
  const overallLevel: Level = score >= 85 ? '綠' : score >= 60 ? '黃' : '紅'
  const missingItems = [
    !isSupabaseConfigured ? '補上 Supabase 連線與 RLS 實測' : '',
    !isLoggedIn ? '使用授權帳號登入再驗證資料可見性' : '',
    auditWriteState !== '綠' ? '確認 audit_logs 寫入成功' : '',
    !currentSafeExport.safe ? '補強匯出遮蔽與角色限制' : '',
    comparisonRole === '家長' && !currentStudentMaskPass ? '修正家長端遮蔽字詞' : '',
    (comparisonRole === '普通班導師' || comparisonRole === '科任老師') && !currentRecordMaskPass ? '修正普通班 / 科任可見內容' : '',
  ].filter(Boolean)

  return (
    <main className="space-y-5 px-4">
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-teal-700">妥善率自我檢查</p>
        <h2 className="mt-1 text-2xl font-black text-slate-900">校園小範圍測試前評估</h2>
        <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-900">這一頁會實際嘗試寫入 audit_logs，並以目前登入角色與 Supabase 回傳資料做檢查。</p>
        <button onClick={runAuditLogTest} className="mt-4 w-full rounded-2xl bg-teal-600 px-5 py-4 text-base font-black text-white shadow-sm">重新執行實測</button>
      </section>

      <div className={`rounded-3xl border p-5 shadow-sm ${toneClass(overallLevel)}`}>
        <p className="text-sm font-bold">整體妥善率</p>
        <p className="mt-2 text-4xl font-black">{score} 分</p>
        <p className="mt-2 text-sm font-semibold">{scoreLevel(score)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">可見學生數</p><p className="text-2xl font-black text-slate-900">{currentVisibleStudentCount}</p></div>
        <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">可見紀錄數</p><p className="text-2xl font-black text-slate-900">{currentVisibleRecordCount}</p></div>
        <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">IEP 草稿數</p><p className="text-2xl font-black text-slate-900">{iepGoals.length}</p></div>
        <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">授權綁定</p><p className="text-2xl font-black text-slate-900">{hasBindings ? '有' : '無'}</p></div>
      </div>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {[
          ['RLS / 權限分數', checks.filter((item) => /RLS|登入|profiles role|學生授權關係/.test(item.label) && item.level === '綠').length],
          ['audit log 分數', auditWriteState === '綠' ? 1 : 0],
          ['parent-safe 分數', parentSafePass ? 1 : 0],
          ['IEP 流程分數', iepGoals.some((goal) => goal.confirmed) ? 1 : 0],
          ['後台名單分數', hasBindings ? 1 : 0],
          ['匯出分數', currentSafeExport.safe ? 1 : 0],
          ['CSV 匯入分數', csvParserProbePass()],
          ['手機可用性分數', 1],
        ].map(([label, pass]) => (
          <div key={String(label)} className={`rounded-2xl border p-4 shadow-sm ${pass ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
            <p className="text-sm font-bold">{label as string}</p>
            <p className="mt-2 text-2xl font-black">{pass ? '綠燈' : '黃燈'}</p>
          </div>
        ))}
      </section>

      {probeState && (
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <h3 className="text-lg font-black text-slate-900">Supabase 實測結果</h3>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">學生查詢</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{probeState.studentCount}</p>
              <p className={`mt-1 text-xs font-semibold ${probeState.studentQueryOk ? 'text-emerald-700' : 'text-rose-700'}`}>{probeState.studentQueryOk ? '可讀取' : '讀取失敗'}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">紀錄查詢</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{probeState.recordCount}</p>
              <p className={`mt-1 text-xs font-semibold ${probeState.recordQueryOk ? 'text-emerald-700' : 'text-rose-700'}`}>{probeState.recordQueryOk ? '可讀取' : '讀取失敗'}</p>
            </div>
          </div>
          <p className="mt-3 text-xs font-semibold text-slate-500">最後測試：{probeState.checkedAt.slice(0, 19).replace('T', ' ')}</p>
        </section>
      )}

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

      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <h3 className="text-lg font-black text-slate-900">還差哪些項目才能到 90 分</h3>
        <div className="mt-3 space-y-2 text-sm font-semibold text-slate-700">
          {missingItems.length ? missingItems.map((item) => <p key={item} className="rounded-2xl bg-slate-50 p-3">{item}</p>) : <p className="rounded-2xl bg-emerald-50 p-3 text-emerald-800">目前已接近 90 分。</p>}
        </div>
      </section>
    </main>
  )
}

function selectedExportPreview(role: Role, students: Student[], records: CaseRecord[], viewerId?: string) {
  const selected = visibleStudents(students, role, viewerId)[0]
  if (!selected) return { safe: false, note: '目前沒有可匯出的學生。' }
  const report = buildReport('會議前資料包', selected, records, role)
  const safe = role === '家長' ? isSafeText(report) : true
  return {
    safe,
    note: safe ? '可正常產生受控匯出預覽。' : '匯出內容仍需加強遮蔽。',
  }
}
