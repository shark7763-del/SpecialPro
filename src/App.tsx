import { useEffect, useMemo, useState } from 'react'
import './index.css'
import { generateFormalRecord, generateIEPDraft, generateParentMessage, generateSemesterSummary, generateTeacherTipCard } from './services/aiService'
import { buildReport, downloadText, studentsToCsv } from './services/exportService'
import { canEditRecords, canSeeSensitive, parentSafeText, visibleRecords, visibleStudents } from './services/permissionService'
import { loadRecords, loadStudents, resetDemoData, saveRecords, saveStudents } from './services/storageService'
import { isSupabaseConfigured } from './services/supabaseClient'
import { pullFromSupabase, pushToSupabase, type SyncResult } from './services/syncService'
import { recordTypes, reportTypes, roles, usageTags } from './utils/constants'
import type { IEPDraft, Record as CaseRecord, RecordType, Role, Student, StudentStatus, UsageTag } from './types'

type Tab = '首頁' | '學生' | '紀錄' | 'IEP' | '報表'

const tabs: Tab[] = ['首頁', '學生', '紀錄', 'IEP', '報表']

const statusLabel: Record<StudentStatus, string> = {
  stable: '穩定',
  observe: '需觀察',
  support: '需支持',
  urgent: '優先處理',
}

const parentStatusLabel: Record<StudentStatus, string> = {
  stable: '穩定適應中',
  observe: '持續觀察中',
  support: '需要一起協助',
  urgent: '需要一起協助',
}

function todayParts() {
  const date = new Date()
  return {
    date: date.toISOString().slice(0, 10),
    time: date.toTimeString().slice(0, 5),
    iso: date.toISOString(),
  }
}

function StatusBadge({ status, role }: { status: StudentStatus; role: Role }) {
  const isParent = role === '家長'
  const label = isParent ? parentStatusLabel[status] : statusLabel[status]
  const tone = status === 'stable' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : status === 'observe' ? 'bg-amber-50 text-amber-700 border-amber-200' : status === 'support' ? 'bg-sky-50 text-sky-700 border-sky-200' : 'bg-rose-50 text-rose-700 border-rose-200'
  return <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${isParent && status === 'urgent' ? 'bg-sky-50 text-sky-700 border-sky-200' : tone}`}>{label}</span>
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function RoleSwitcher({ role, setRole }: { role: Role; setRole: (role: Role) => void }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <label className="text-sm font-semibold text-slate-600">目前角色</label>
      <select value={role} onChange={(event) => setRole(event.target.value as Role)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-bold text-slate-900">
        {roles.map((item) => <option key={item}>{item}</option>)}
      </select>
    </div>
  )
}

function BottomNav({ tab, setTab }: { tab: Tab; setTab: (tab: Tab) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto grid max-w-3xl grid-cols-5">
        {tabs.map((item) => (
          <button key={item} onClick={() => setTab(item)} className={`min-h-16 px-2 py-2 text-sm font-bold ${tab === item ? 'text-teal-700' : 'text-slate-500'}`}>
            <div className={`mx-auto mb-1 h-1 w-8 rounded-full ${tab === item ? 'bg-teal-500' : 'bg-transparent'}`} />
            {item}
          </button>
        ))}
      </div>
    </nav>
  )
}

function Header({ role, setRole, onReset, syncResult, onPushSync, onPullSync }: { role: Role; setRole: (role: Role) => void; onReset: () => void; syncResult: SyncResult | null; onPushSync: () => void; onPullSync: () => void }) {
  return (
    <header className="space-y-4">
      <div className="rounded-b-[2rem] bg-gradient-to-br from-teal-700 to-sky-700 px-5 py-7 text-white shadow-sm">
        <div className="flex items-center gap-4">
          <img src={`${import.meta.env.BASE_URL}特教logo.png`} alt="SpecialPro 特教 logo" className="h-16 w-16 rounded-2xl bg-white object-cover p-1 shadow-sm" />
          <div>
            <p className="text-sm font-semibold opacity-90">SpecialPro</p>
            <h1 className="mt-1 text-2xl font-black">特教導師減壓戰情室</h1>
            <p className="mt-2 text-sm text-teal-50">平常簡單記，期末自動整理。</p>
          </div>
        </div>
      </div>
      <div className="px-4">
        <RoleSwitcher role={role} setRole={setRole} />
        <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-900">後台同步</p>
              <p className={`mt-1 text-xs font-semibold ${isSupabaseConfigured ? 'text-teal-700' : 'text-amber-700'}`}>
                {isSupabaseConfigured ? 'Supabase 已設定' : '尚未設定 Supabase，現在使用本機儲存'}
              </p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${isSupabaseConfigured ? 'bg-teal-50 text-teal-700' : 'bg-amber-50 text-amber-700'}`}>
              {isSupabaseConfigured ? '可同步' : '離線'}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={onPushSync} className="rounded-xl bg-teal-600 px-3 py-3 text-sm font-bold text-white">上傳後台</button>
            <button onClick={onPullSync} className="rounded-xl bg-slate-100 px-3 py-3 text-sm font-bold text-slate-800">下載後台</button>
          </div>
          {syncResult && <p className={`mt-2 text-xs font-semibold ${syncResult.ok ? 'text-teal-700' : 'text-rose-700'}`}>{syncResult.message}</p>}
        </div>
        <button onClick={onReset} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm">重設 demo data</button>
      </div>
    </header>
  )
}

function ChairDashboard({ students, records }: { students: Student[]; records: CaseRecord[] }) {
  const draftCount = records.filter((record) => record.status === 'draft').length
  const urgentCount = students.filter((student) => student.status === 'urgent').length
  const metrics = [
    ['IEP 完成率', 78],
    ['會議紀錄完成率', 64],
    ['評量調整確認率', Math.round((students.filter((s) => s.assessmentAdjustments.notifiedHomeroom).length / students.length) * 100)],
    ['支持服務追蹤狀態', 72],
  ]
  return (
    <main className="space-y-5 px-4">
      <Section title="組長戰情室">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">鑑定安置資料待辦</p><p className="text-3xl font-black text-teal-700">3</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">轉銜資料待辦</p><p className="text-3xl font-black text-teal-700">5</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">未完成紀錄</p><p className="text-3xl font-black text-amber-700">{draftCount}</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">優先協助學生</p><p className="text-3xl font-black text-rose-700">{urgentCount}</p></div>
        </div>
      </Section>
      <Section title="全校進度">
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {metrics.map(([label, value]) => (
            <div key={label}>
              <div className="mb-2 flex justify-between text-sm font-bold text-slate-700"><span>{label}</span><span>{value}%</span></div>
              <div className="h-3 rounded-full bg-slate-100"><div className="h-3 rounded-full bg-teal-500" style={{ width: `${value}%` }} /></div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="各老師未完成事項">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
          <p>林特教：2 筆未定稿、1 份 IEP 待確認</p>
          <p>周特教：1 筆普通班回饋待回覆、2 份轉銜資料待整理</p>
        </div>
      </Section>
    </main>
  )
}

function HomePage({ role, students, records, setTab }: { role: Role; students: Student[]; records: CaseRecord[]; setTab: (tab: Tab) => void }) {
  if (role === '特教組長') return <ChairDashboard students={students} records={records} />
  if (role === '家長') return <ParentHome student={students[0]} />

  const visible = visibleStudents(students, role)
  const drafts = visibleRecords(records, students, role).filter((record) => record.status === 'draft')

  if (role === '普通班導師' || role === '科任老師') {
    return (
      <main className="space-y-5 px-4">
        <Section title="我的學生">
          <div className="space-y-3">{visible.map((student) => <LimitedStudentCard key={student.id} student={student} role={role} />)}</div>
        </Section>
        <button onClick={() => setTab('紀錄')} className="w-full rounded-2xl bg-teal-600 px-5 py-4 text-lg font-black text-white shadow-sm">今日快速回報</button>
      </main>
    )
  }

  return (
    <main className="space-y-6 px-4">
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-teal-700">今日減壓中心</p>
        <h2 className="mt-1 text-2xl font-black text-slate-900">老師快速記，系統自動整理。</h2>
        <button onClick={() => setTab('紀錄')} className="mt-4 w-full rounded-2xl bg-teal-600 px-5 py-4 text-lg font-black text-white shadow-sm">30秒快速記</button>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {['情緒紀錄', '親師溝通', '課堂觀察', '普通班回饋'].map((item) => <button key={item} onClick={() => setTab('紀錄')} className="rounded-xl bg-teal-50 px-3 py-3 text-sm font-bold text-teal-800">{item}</button>)}
        </div>
      </section>
      <Section title="今天最重要 3 件事">
        <div className="space-y-2">{['王○安 IEP 會議紀錄尚未確認', '李○庭 家長訊息待回覆', '陳○恩 段考評量調整待確認'].map((item) => <div key={item} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">{item}</div>)}</div>
      </Section>
      <Section title="即將到期提醒">
        <div className="grid grid-cols-2 gap-2">{['IEP 檢討', '會議紀錄', '評量調整', '支持服務追蹤', '轉銜資料'].map((item) => <div key={item} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-700 shadow-sm">{item}</div>)}</div>
      </Section>
      <Section title="需要關心學生">
        <div className="space-y-3">{visible.map((student) => <div key={student.id} className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm"><div><p className="font-black text-slate-900">{student.name}</p><p className="text-sm text-slate-500">{student.className}｜{student.mainNeeds.join('、')}</p></div><StatusBadge status={student.status} role={role} /></div>)}</div>
      </Section>
      <Section title="未完成紀錄">
        <div className="space-y-3">{drafts.length ? drafts.map((record) => <div key={record.id} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-sm"><p className="font-bold text-slate-900">{students.find((s) => s.id === record.studentId)?.name}｜AI 草稿待確認</p><p className="mt-2">{record.aiDraft}</p></div>) : <p className="rounded-2xl bg-white p-4 text-sm text-slate-500 shadow-sm">目前沒有未完成紀錄。</p>}</div>
      </Section>
    </main>
  )
}

function ParentHome({ student }: { student: Student }) {
  return (
    <main className="space-y-5 px-4">
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-teal-700">本週狀態</p>
        <h2 className="mt-1 text-2xl font-black text-slate-900">{student.name}正在穩定練習中</h2>
        <p className="mt-3 text-slate-700">孩子目前正在練習{student.mainNeeds.join('和')}。學校會持續協助，也會用溫和、具體的方式支持孩子參與學習。</p>
      </section>
      {[
        ['老師提醒', `家裡可以一起配合固定作息，並用一句話提醒孩子準備明天用品。`],
        ['孩子進步', `本週已有進步，能在提醒下完成部分任務。`],
        ['需要家裡協助', `若孩子提到課堂或同儕互動壓力，可先聽孩子說，再與老師聯繫。`],
        ['會議通知', `IEP 檢討會議前，老師會先整理孩子目前練習狀況。`],
        ['評量調整說明', parentSafeText(`學校會提供${student.assessmentAdjustments.note}`)],
      ].map(([title, body]) => <section key={title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="font-black text-slate-900">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-700">{body}</p></section>)}
    </main>
  )
}

function StudentCard({ student, role, records, onDetail, onRecord, onMessage, onIep, onReport }: { student: Student; role: Role; records: CaseRecord[]; onDetail: () => void; onRecord: () => void; onMessage: () => void; onIep: () => void; onReport: () => void }) {
  const recent = records.find((record) => record.studentId === student.id)
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-black text-slate-900">{student.name}｜{student.className}</h3>
          <p className="mt-1 text-sm text-slate-500">主要需求：{student.mainNeeds.join('、')}</p>
        </div>
        <StatusBadge status={student.status} role={role} />
      </div>
      <div className="mt-4 space-y-2 text-sm leading-6 text-slate-700">
        <p><b>IEP 重點：</b>{student.iepFocus.join('、')}</p>
        <p><b>支持策略：</b>{student.supportStrategies.slice(0, 3).join('、')}</p>
        <p><b>普通班提醒：</b>{student.regularClassTips.slice(0, 2).join('、')}</p>
        <p><b>評量調整：</b>{student.assessmentAdjustments.note}</p>
        <p><b>支持服務：</b>{student.supportServices.map((service) => `${service.type} ${service.status}`).join('、')}</p>
        <p><b>最近紀錄：</b>{recent?.finalText || recent?.aiDraft || '尚無紀錄'}</p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button onClick={onDetail} className="rounded-xl bg-slate-900 px-3 py-3 text-sm font-bold text-white">查看個案</button>
        {canEditRecords(role) && <button onClick={onRecord} className="rounded-xl bg-teal-600 px-3 py-3 text-sm font-bold text-white">新增紀錄</button>}
        {canEditRecords(role) && <button onClick={onMessage} className="rounded-xl bg-sky-50 px-3 py-3 text-sm font-bold text-sky-800">產生家長訊息</button>}
        {canEditRecords(role) && <button onClick={onIep} className="rounded-xl bg-amber-50 px-3 py-3 text-sm font-bold text-amber-800">IEP 摘要</button>}
        {canEditRecords(role) && <button onClick={onReport} className="col-span-2 rounded-xl bg-slate-100 px-3 py-3 text-sm font-bold text-slate-800">匯出資料</button>}
      </div>
    </article>
  )
}

function LimitedStudentCard({ student, role, onFeedback }: { student: Student; role: Role; onFeedback?: (student: Student, type: 'stable' | 'help') => void }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-xl font-black text-slate-900">{student.name}｜{student.className}</h3>
      <div className="mt-4 rounded-2xl bg-teal-50 p-4">
        <p className="font-black text-teal-900">普通班提醒卡</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-teal-900">{student.regularClassTips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
      </div>
      <div className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700"><b>評量調整：</b>{student.assessmentAdjustments.note}</div>
      {role === '普通班導師' && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button onClick={() => onFeedback?.(student, 'stable')} className="rounded-xl bg-emerald-50 px-2 py-3 text-sm font-bold text-emerald-800">今日穩定</button>
          <button onClick={() => onFeedback?.(student, 'help')} className="rounded-xl bg-amber-50 px-2 py-3 text-sm font-bold text-amber-800">需要協助</button>
          <button onClick={() => onFeedback?.(student, 'help')} className="rounded-xl bg-sky-50 px-2 py-3 text-sm font-bold text-sky-800">新增回饋</button>
        </div>
      )}
    </article>
  )
}

function StudentsPage({ role, students, records, setTab, createFeedback }: { role: Role; students: Student[]; records: CaseRecord[]; setTab: (tab: Tab) => void; createFeedback: (student: Student, type: 'stable' | 'help') => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const visible = visibleStudents(students, role)
  const selected = visible.find((student) => student.id === selectedId)

  if (role === '普通班導師' || role === '科任老師') {
    return <main className="space-y-4 px-4">{visible.map((student) => <LimitedStudentCard key={student.id} student={student} role={role} onFeedback={createFeedback} />)}</main>
  }
  if (role === '家長') return <StudentDetail student={visible[0]} records={records} role={role} />
  if (selected) return <StudentDetail student={selected} records={records} role={role} onBack={() => setSelectedId(null)} />

  return (
    <main className="space-y-4 px-4">
      {visible.map((student) => <StudentCard key={student.id} student={student} role={role} records={records} onDetail={() => setSelectedId(student.id)} onRecord={() => setTab('紀錄')} onMessage={() => setTab('紀錄')} onIep={() => setTab('IEP')} onReport={() => setTab('報表')} />)}
    </main>
  )
}

function StudentDetail({ student, records, role, onBack }: { student: Student; records: CaseRecord[]; role: Role; onBack?: () => void }) {
  const safe = role === '家長'
  const studentRecords = records.filter((record) => record.studentId === student.id && (record.status === 'confirmed' || canSeeSensitive(role)))
  const communication = studentRecords.filter((record) => record.type === '親師溝通')
  const behavior = studentRecords.filter((record) => record.type === '情緒行為')
  const summary = generateSemesterSummary(student, studentRecords)
  return (
    <main className="space-y-4 px-4">
      {onBack && <button onClick={onBack} className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-sm">返回學生列表</button>}
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-black text-slate-900">{student.name}｜完整學生個案</h2>
        <p className="mt-2 text-sm text-slate-500">{student.className}｜特教老師：{student.specialTeacher}</p>
      </section>
      {[
        ['基本資料', safe ? `孩子目前正在練習${student.mainNeeds.join('、')}` : `年級：${student.grade}｜導師：${student.homeroomTeacher}｜家長：${student.parentName} ${student.parentContact}`],
        ['主要需求', student.mainNeeds.join('、')],
        ['IEP 重點', student.iepFocus.join('、')],
        ['支持策略', student.supportStrategies.join('、')],
        ['普通班提醒卡', generateTeacherTipCard(student)],
        ['評量調整', student.assessmentAdjustments.note],
        ['支持服務', student.supportServices.map((service) => `${service.type}｜${service.status}｜下次追蹤 ${service.nextFollowUpDate}`).join('\n')],
        ['親師溝通紀錄', communication.map((record) => record.finalText || record.aiDraft).join('\n') || '尚無確認紀錄'],
        ['情緒行為紀錄', safe ? '孩子目前正在練習情緒表達，學校會持續協助。' : behavior.map((record) => record.finalText || record.aiDraft).join('\n') || '尚無確認紀錄'],
        ['學期摘要', safe ? parentSafeText(summary) : summary],
      ].map(([title, body]) => <section key={title} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="font-black text-slate-900">{title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{body}</p></section>)}
      {canSeeSensitive(role) && <section className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-900"><b>敏感資料：</b>{student.sensitiveNotes}</section>}
    </main>
  )
}

function RecordsPage({ role, students, records, addRecord, confirmRecord, createFeedback }: { role: Role; students: Student[]; records: CaseRecord[]; addRecord: (record: CaseRecord) => void; confirmRecord: (id: string, finalText: string) => void; createFeedback: (student: Student, type: 'stable' | 'help') => void }) {
  const visible = visibleStudents(students, role)
  const [studentId, setStudentId] = useState(visible[0]?.id || '')
  const [type, setType] = useState<RecordType>('情緒行為')
  const [rawText, setRawText] = useState('小安第三節因為同學碰到他的鉛筆盒大叫，我帶他到資源班冷靜，已通知媽媽，明天再觀察同儕互動。')
  const [draft, setDraft] = useState<CaseRecord | null>(null)
  const [selectedTags, setSelectedTags] = useState<UsageTag[]>(['IEP檢討', '家長溝通', '學期摘要'])
  const [situation, setSituation] = useState('情緒需要觀察')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!visible.find((student) => student.id === studentId)) setStudentId(visible[0]?.id || '')
  }, [role, visible, studentId])

  const selected = students.find((student) => student.id === studentId) || visible[0]

  if (role === '普通班導師') {
    return <main className="space-y-4 px-4"><Section title="今日快速回報"><div className="space-y-3">{visible.map((student) => <LimitedStudentCard key={student.id} student={student} role={role} onFeedback={createFeedback} />)}</div></Section></main>
  }
  if (role === '科任老師' || role === '家長') return <main className="px-4"><p className="rounded-2xl bg-white p-5 text-slate-700 shadow-sm">此角色僅能查看提醒卡與評量調整，不提供完整紀錄編輯。</p></main>

  const makeDraft = () => {
    if (!selected || !rawText.trim()) return
    const parts = todayParts()
    const ai = generateFormalRecord(rawText, type)
    setDraft({
      id: crypto.randomUUID(),
      studentId: selected.id,
      date: parts.date,
      time: parts.time,
      location: ai.location,
      type,
      rawText,
      aiDraft: ai.aiDraft,
      finalText: ai.aiDraft.replace('AI 草稿，需由老師確認。', ''),
      antecedent: ai.antecedent,
      behavior: ai.behavior,
      intervention: ai.intervention,
      result: ai.result,
      followUp: ai.followUp,
      parentNotified: ai.parentNotified,
      usageTags: selectedTags,
      status: 'draft',
      createdBy: role,
      createdAt: parts.iso,
    })
  }

  const saveDraft = () => {
    if (!draft) return
    addRecord(draft)
    setDraft(null)
    setRawText('')
  }

  const produceMessage = (tone: 'formal' | 'warm' | 'short') => {
    if (!selected) return
    setMessage(generateParentMessage(selected, situation, tone))
  }

  return (
    <main className="space-y-5 px-4">
      <Section title="30秒快速記">
        <div className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
          <label className="block text-sm font-bold text-slate-700">Step 1：選學生</label>
          <select value={studentId} onChange={(event) => setStudentId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">{visible.map((student) => <option key={student.id} value={student.id}>{student.name}｜{student.className}</option>)}</select>
          <label className="block text-sm font-bold text-slate-700">Step 2：選事件類型</label>
          <select value={type} onChange={(event) => setType(event.target.value as RecordType)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">{recordTypes.map((item) => <option key={item}>{item}</option>)}</select>
          <label className="block text-sm font-bold text-slate-700">Step 3：輸入一句口語紀錄</label>
          <textarea value={rawText} onChange={(event) => setRawText(event.target.value)} rows={4} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 leading-6" />
          <div className="grid grid-cols-2 gap-2">{usageTags.map((tag) => <label key={tag} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-semibold"><input type="checkbox" checked={selectedTags.includes(tag)} onChange={() => setSelectedTags((prev) => prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag])} />{tag}</label>)}</div>
          <button onClick={makeDraft} className="w-full rounded-2xl bg-teal-600 px-5 py-4 text-lg font-black text-white">AI 整理成正式紀錄草稿</button>
        </div>
      </Section>

      {draft && (
        <Section title="AI 草稿">
          <div className="space-y-3 rounded-3xl border border-teal-200 bg-teal-50 p-5 shadow-sm">
            <p className="font-black text-teal-900">AI 草稿，需由老師確認後才會定稿。</p>
            <textarea value={draft.finalText} onChange={(event) => setDraft({ ...draft, finalText: event.target.value })} rows={7} className="w-full rounded-xl border border-teal-200 bg-white px-4 py-3 leading-6" />
            <div className="grid grid-cols-2 gap-2 text-sm text-slate-700">
              <p><b>發生時間：</b>{draft.date} {draft.time}</p><p><b>地點：</b>{draft.location}</p>
              <p><b>前因：</b>{draft.antecedent}</p><p><b>行為表現：</b>{draft.behavior}</p>
              <p><b>處理方式：</b>{draft.intervention}</p><p><b>結果：</b>{draft.result}</p>
              <p><b>後續追蹤：</b>{draft.followUp}</p><p><b>是否通知家長：</b>{draft.parentNotified ? '是' : '否'}</p>
            </div>
            <div className="grid grid-cols-2 gap-2"><button onClick={() => setDraft(null)} className="rounded-xl bg-white px-4 py-3 font-bold text-slate-700">回到編輯</button><button onClick={saveDraft} className="rounded-xl bg-teal-700 px-4 py-3 font-bold text-white">老師確認定稿</button></div>
          </div>
        </Section>
      )}

      <Section title="親師溝通助手">
        <div className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
          <select value={situation} onChange={(event) => setSituation(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">{['今日表現穩定', '情緒需要觀察', '作業完成困難', '與同儕互動需協助', '普通班適應狀況', '需要家長協助', '會議通知', '評量調整說明', '支持服務進度', '孩子有明顯進步'].map((item) => <option key={item}>{item}</option>)}</select>
          <div className="grid grid-cols-3 gap-2"><button onClick={() => produceMessage('formal')} className="rounded-xl bg-slate-100 py-3 font-bold">更正式</button><button onClick={() => produceMessage('warm')} className="rounded-xl bg-teal-50 py-3 font-bold text-teal-800">更溫和</button><button onClick={() => produceMessage('short')} className="rounded-xl bg-sky-50 py-3 font-bold text-sky-800">更簡短</button></div>
          <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={5} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 leading-6" placeholder="產生後可編輯 LINE 訊息" />
          <div className="grid grid-cols-2 gap-2"><button onClick={() => navigator.clipboard.writeText(message)} className="rounded-xl bg-slate-900 px-4 py-3 font-bold text-white">複製 LINE 文字</button><button onClick={() => selected && message && addRecord({ id: crypto.randomUUID(), studentId: selected.id, date: todayParts().date, time: todayParts().time, location: 'LINE', type: '親師溝通', rawText: situation, aiDraft: message, finalText: message.replace('AI 草稿，需由老師確認。', ''), antecedent: situation, behavior: '親師溝通', intervention: '提供溫和具體說明', result: '已產生可傳送文字', followUp: '視家長回覆追蹤', parentNotified: true, usageTags: ['家長溝通', '學期摘要'], status: 'confirmed', createdBy: role, createdAt: todayParts().iso, confirmedAt: todayParts().iso })} className="rounded-xl bg-teal-600 px-4 py-3 font-bold text-white">儲存為親師溝通紀錄</button></div>
        </div>
      </Section>

      <Section title="近期紀錄">
        <div className="space-y-3">{visibleRecords(records, students, role).map((record) => <div key={record.id} className="rounded-2xl bg-white p-4 text-sm shadow-sm"><p className="font-black text-slate-900">{students.find((s) => s.id === record.studentId)?.name}｜{record.type}｜{record.status === 'draft' ? 'AI 草稿' : '已定稿'}</p><p className="mt-2 text-slate-700">{record.finalText || record.aiDraft}</p>{record.status === 'draft' && <button onClick={() => confirmRecord(record.id, record.aiDraft.replace('AI 草稿，需由老師確認。', ''))} className="mt-3 rounded-xl bg-teal-600 px-4 py-2 font-bold text-white">確認定稿</button>}</div>)}</div>
      </Section>
    </main>
  )
}

function IEPPage({ role, students, updateStudent }: { role: Role; students: Student[]; updateStudent: (student: Student) => void }) {
  const visible = visibleStudents(students, role)
  const [studentId, setStudentId] = useState(visible[0]?.id || '')
  const [input, setInput] = useState('閱讀速度慢，理解題容易抓不到重點，上課容易分心，需要關鍵字提示。')
  const [draft, setDraft] = useState<IEPDraft | null>(null)
  const selected = students.find((student) => student.id === studentId) || visible[0]

  useEffect(() => {
    if (!visible.find((student) => student.id === studentId)) setStudentId(visible[0]?.id || '')
  }, [role, visible, studentId])

  if (role === '家長') return <main className="px-4"><ParentHome student={visible[0]} /></main>
  if (role === '普通班導師' || role === '科任老師') return <main className="space-y-4 px-4">{visible.map((student) => <LimitedStudentCard key={student.id} student={student} role={role} />)}</main>

  return (
    <main className="space-y-5 px-4">
      <Section title="IEP / 會議助手">
        <div className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
          <select value={studentId} onChange={(event) => setStudentId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">{visible.map((student) => <option key={student.id} value={student.id}>{student.name}｜{student.className}</option>)}</select>
          <textarea value={input} onChange={(event) => setInput(event.target.value)} rows={4} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 leading-6" />
          <button onClick={() => selected && setDraft(generateIEPDraft(selected, input))} className="w-full rounded-2xl bg-teal-600 px-5 py-4 text-lg font-black text-white">產生 IEP 草稿</button>
        </div>
      </Section>
      {draft && <Section title="AI 草稿，需由老師確認"><div className="space-y-3 rounded-3xl border border-teal-200 bg-teal-50 p-5 shadow-sm">{Object.entries(draft).map(([key, value]) => <div key={key} className="rounded-2xl bg-white p-4"><h3 className="font-black text-slate-900">{({ currentLevel: '現況描述草稿', needsAnalysis: '需求分析草稿', semesterGoal: '學期目標草稿', strategies: '支持策略建議', evaluationMethods: '評量方式建議', reviewSummary: 'IEP 檢討摘要', parentExplanation: '家長版說明', meetingPackage: '會議前資料包' } as Record<string, string>)[key]}</h3><textarea value={Array.isArray(value) ? value.join('\n') : value} onChange={(event) => setDraft({ ...draft, [key]: key === 'strategies' || key === 'evaluationMethods' ? event.target.value.split('\n') : event.target.value })} rows={Array.isArray(value) ? 5 : 3} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6" /></div>)}<button className="w-full rounded-xl bg-teal-700 px-4 py-3 font-bold text-white">老師確認 IEP 草稿</button></div></Section>}
      <AssessmentManager students={students} updateStudent={updateStudent} />
    </main>
  )
}

function AssessmentManager({ students, updateStudent }: { students: Student[]; updateStudent: (student: Student) => void }) {
  const toggle = (student: Student, key: keyof Student['assessmentAdjustments']) => {
    const value = student.assessmentAdjustments[key]
    if (typeof value !== 'boolean') return
    updateStudent({ ...student, assessmentAdjustments: { ...student.assessmentAdjustments, [key]: !value } })
  }
  const checks = ['段考前 14 天：確認評量調整名單', '段考前 7 天：通知普通班導師、科任老師、教務處', '段考前 3 天：確認考場、報讀人員、延長時間、電腦或輔具', '段考後：記錄調整成效與下次修正']
  const bools: [keyof Student['assessmentAdjustments'], string][] = [['extendedTime', '延長時間'], ['readAloud', '報讀'], ['separateRoom', '獨立考場'], ['reducedItems', '減量'], ['alternativeAssessment', '替代評量'], ['computerInput', '電腦作答'], ['notifiedHomeroom', '已通知導師'], ['notifiedSubjectTeachers', '已通知科任'], ['notifiedAcademicOffice', '已通知教務處']]
  return (
    <Section title="評量調整管理">
      <div className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="space-y-2">{checks.map((item) => <label key={item} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-sm font-semibold"><input type="checkbox" />{item}</label>)}</div>
      </div>
      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[920px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600"><tr>{['學生', '班級', ...bools.map(([, label]) => label), '段考後檢討'].map((head) => <th key={head} className="px-3 py-3">{head}</th>)}</tr></thead>
          <tbody>{students.map((student) => <tr key={student.id} className="border-t border-slate-100"><td className="px-3 py-3 font-bold">{student.name}</td><td className="px-3 py-3">{student.className}</td>{bools.map(([key]) => <td key={key} className="px-3 py-3"><input type="checkbox" checked={Boolean(student.assessmentAdjustments[key])} onChange={() => toggle(student, key)} /></td>)}<td className="px-3 py-3"><input value={student.assessmentAdjustments.postExamReview} onChange={(event) => updateStudent({ ...student, assessmentAdjustments: { ...student.assessmentAdjustments, postExamReview: event.target.value } })} className="rounded-lg border border-slate-200 px-2 py-1" placeholder="輸入檢討" /></td></tr>)}</tbody>
        </table>
      </div>
    </Section>
  )
}

function ReportsPage({ role, students, records }: { role: Role; students: Student[]; records: CaseRecord[] }) {
  const visible = visibleStudents(students, role)
  const [studentId, setStudentId] = useState(visible[0]?.id || '')
  const [type, setType] = useState('交接資料包')
  const [content, setContent] = useState('')
  const selected = students.find((student) => student.id === studentId) || visible[0]

  if (role === '普通班導師' || role === '科任老師' || role === '家長') return <main className="px-4"><p className="rounded-2xl bg-white p-5 text-slate-700 shadow-sm">此角色不提供完整匯出，請由特教老師確認資料使用範圍。</p></main>

  const produce = () => selected && setContent(buildReport(type, selected, records))
  const html = `<html><head><meta charset="utf-8"><title>${type}</title></head><body><pre>${content.replace(/[&<>]/g, (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[s] || s)}</pre></body></html>`
  return (
    <main className="space-y-5 px-4">
      <Section title="文件與交接中心">
        <div className="space-y-3 rounded-3xl bg-white p-5 shadow-sm">
          <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-900">請確認資料使用範圍，避免分享給無關人員。</p>
          <select value={studentId} onChange={(event) => setStudentId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">{visible.map((student) => <option key={student.id} value={student.id}>{student.name}｜{student.className}</option>)}</select>
          <select value={type} onChange={(event) => setType(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">{reportTypes.map((item) => <option key={item}>{item}</option>)}</select>
          <button onClick={produce} className="w-full rounded-2xl bg-teal-600 px-5 py-4 text-lg font-black text-white">產生報表文字</button>
        </div>
      </Section>
      <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={14} className="w-full rounded-3xl border border-slate-200 bg-white p-5 text-sm leading-6 shadow-sm" />
      <div className="grid grid-cols-2 gap-2 px-1">
        <button onClick={() => navigator.clipboard.writeText(content)} className="rounded-xl bg-slate-900 px-4 py-3 font-bold text-white">複製文字</button>
        <button onClick={() => downloadText(`${type}.json`, JSON.stringify({ type, student: selected, content, createdAt: todayParts().iso }, null, 2), 'application/json;charset=utf-8')} className="rounded-xl bg-slate-100 px-4 py-3 font-bold text-slate-800">下載 JSON</button>
        <button onClick={() => downloadText('評量調整清單.csv', studentsToCsv(students), 'text/csv;charset=utf-8')} className="rounded-xl bg-slate-100 px-4 py-3 font-bold text-slate-800">下載 CSV</button>
        <button onClick={() => window.print()} className="rounded-xl bg-slate-100 px-4 py-3 font-bold text-slate-800">瀏覽器列印</button>
        <button onClick={() => downloadText(`${type}.html`, html, 'text/html;charset=utf-8')} className="col-span-2 rounded-xl bg-teal-50 px-4 py-3 font-bold text-teal-800">匯出 HTML 文件</button>
      </div>
    </main>
  )
}

export default function App() {
  const [students, setStudents] = useState<Student[]>(() => loadStudents())
  const [records, setRecords] = useState<CaseRecord[]>(() => loadRecords())
  const [role, setRole] = useState<Role>('特教導師')
  const [tab, setTab] = useState<Tab>('首頁')
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)

  useEffect(() => saveStudents(students), [students])
  useEffect(() => saveRecords(records), [records])

  const page = useMemo(() => {
    const addRecord = (record: CaseRecord) => setRecords((prev) => [{ ...record, status: 'confirmed', confirmedAt: todayParts().iso }, ...prev])
    const confirmRecord = (id: string, finalText: string) => setRecords((prev) => prev.map((record) => record.id === id ? { ...record, finalText, status: 'confirmed', confirmedAt: todayParts().iso } : record))
    const updateStudent = (student: Student) => setStudents((prev) => prev.map((item) => item.id === student.id ? { ...student, updatedAt: todayParts().iso } : item))
    const createFeedback = (student: Student, type: 'stable' | 'help') => {
      const parts = todayParts()
      setRecords((prev) => [{
        id: crypto.randomUUID(),
        studentId: student.id,
        date: parts.date,
        time: parts.time,
        location: '普通班',
        type: '普通班回饋',
        rawText: type === 'stable' ? '今日穩定' : '需要協助',
        aiDraft: `AI 草稿，需由老師確認。普通班導師回報：${student.name}${type === 'stable' ? '今日穩定適應。' : '今日需要特教老師協助追蹤。'}`,
        finalText: '',
        antecedent: '普通班回報',
        behavior: type === 'stable' ? '穩定參與' : '需要協助',
        intervention: '待特教老師追蹤',
        result: '已建立提醒',
        followUp: '特教老師首頁提醒',
        parentNotified: false,
        usageTags: ['普通班合作', '學期摘要'],
        status: 'draft',
        createdBy: '普通班導師',
        createdAt: parts.iso,
      }, ...prev])
      setTab('首頁')
    }
    if (tab === '首頁') return <HomePage role={role} students={students} records={records} setTab={setTab} />
    if (tab === '學生') return <StudentsPage role={role} students={students} records={records} setTab={setTab} createFeedback={createFeedback} />
    if (tab === '紀錄') return <RecordsPage role={role} students={students} records={records} addRecord={addRecord} confirmRecord={confirmRecord} createFeedback={createFeedback} />
    if (tab === 'IEP') return <IEPPage role={role} students={students} updateStudent={updateStudent} />
    return <ReportsPage role={role} students={students} records={records} />
  }, [tab, role, students, records])

  const handleReset = () => {
    resetDemoData()
    setStudents(loadStudents())
    setRecords(loadRecords())
    setTab('首頁')
  }

  const handlePushSync = async () => {
    setSyncResult({ ok: true, message: '同步中...' })
    setSyncResult(await pushToSupabase(students, records, role))
  }

  const handlePullSync = async () => {
    setSyncResult({ ok: true, message: '下載中...' })
    const { result, students: remoteStudents, records: remoteRecords } = await pullFromSupabase()
    if (result.ok && remoteStudents && remoteRecords) {
      setStudents(remoteStudents)
      setRecords(remoteRecords)
    }
    setSyncResult(result)
  }

  return (
    <div className="min-h-screen bg-[#f6f7f4] pb-24 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <Header role={role} setRole={setRole} onReset={handleReset} syncResult={syncResult} onPushSync={handlePushSync} onPullSync={handlePullSync} />
        <div className="mt-5">{page}</div>
      </div>
      <BottomNav tab={tab} setTab={setTab} />
    </div>
  )
}
