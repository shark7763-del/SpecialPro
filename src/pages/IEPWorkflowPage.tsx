import { useEffect, useMemo, useState } from 'react'
import { PrivacyNotice } from '../components/PrivacyNotice'
import { generateIEPDraft, generateTeacherTipCard } from '../services/aiService'
import { createAuditLog } from '../services/rosterService'
import { canSeeSensitive, parentSafeText, visibleStudents } from '../services/permissionService'
import { getTaipeiISOString } from '../utils/date'
import type { IEPDraft, IEPGoal, Record as CaseRecord, Role, Student } from '../types'

type SectionStatus = '未開始' | '草稿' | '已確認'
type SectionKey =
  | 'studentSummary'
  | 'currentLevel'
  | 'learningNeeds'
  | 'behaviorSupport'
  | 'semesterGoal'
  | 'strategies'
  | 'evaluation'
  | 'services'
  | 'parentParticipation'
  | 'meetingNotes'
  | 'semesterReview'
  | 'transfer'
  | 'nextTodo'

interface Props {
  role: Role
  students: Student[]
  records: CaseRecord[]
  iepGoals: IEPGoal[]
  saveIepGoal: (goal: IEPGoal) => void
  updateStudent: (student: Student) => void
  viewerId?: string
  schoolId?: string
}

interface SectionState {
  status: SectionStatus
  owner: string
  updatedAt: string
  content: string
}

interface LawCheckItem {
  label: string
  status: '完成' | '待補'
  evidence: string
  suggestion: string
}

const sectionLabels: Array<[SectionKey, string]> = [
  ['studentSummary', '學生基本摘要'],
  ['currentLevel', '現況能力'],
  ['learningNeeds', '學習需求'],
  ['behaviorSupport', '行為與情緒支持需求'],
  ['semesterGoal', '學期目標'],
  ['strategies', '支持策略'],
  ['evaluation', '評量調整'],
  ['services', '相關服務'],
  ['parentParticipation', '家長參與紀錄'],
  ['meetingNotes', '會議紀錄'],
  ['semesterReview', '學期檢討'],
  ['transfer', '轉銜資料'],
  ['nextTodo', '下一步待辦'],
]

function sectionTone(status: SectionStatus) {
  if (status === '已確認') return 'bg-emerald-50 text-emerald-700 border-emerald-200'
  if (status === '草稿') return 'bg-amber-50 text-amber-700 border-amber-200'
  return 'bg-slate-50 text-slate-600 border-slate-200'
}

function buildSectionTexts(student: Student, draft: IEPDraft) {
  return {
    studentSummary: `${student.name}｜${student.className}｜${student.mainNeeds.join('、') || student.mainNeed || '待補充'}`,
    currentLevel: draft.currentLevel,
    learningNeeds: draft.needsAnalysis,
    behaviorSupport: `目前以${student.status === 'urgent' ? '優先支持' : '持續支持'}為原則，搭配座位調整、清楚步驟與口語提醒。`,
    semesterGoal: draft.semesterGoal,
    strategies: draft.strategies.join('、'),
    evaluation: draft.evaluationMethods.join('、'),
    services: student.supportServices.map((service) => `${service.type}｜${service.status}`).join('；') || '尚無相關服務',
    parentParticipation: draft.parentExplanation,
    meetingNotes: draft.meetingPackage,
    semesterReview: draft.reviewSummary,
    transfer: `延續有效策略：${student.supportStrategies.join('、') || '待補充'}`,
    nextTodo: `持續追蹤 ${student.mainNeeds[0] || student.mainNeed || '學習支持'} 的穩定度與普通班合作成效。`,
  }
}

function buildLawChecklist(student: Student, draft: IEPDraft | null, iepGoals: IEPGoal[], records: CaseRecord[]) {
  const studentRecords = records.filter((record) => record.studentId === student.id)
  const confirmedGoals = iepGoals.filter((goal) => goal.studentId === student.id && goal.confirmed)
  const latestGoal = confirmedGoals[0] || iepGoals.find((goal) => goal.studentId === student.id) || null
  const currentLevel = latestGoal?.currentLevel || draft?.currentLevel || student.iepFocus.join('、')
  const strategies = latestGoal?.strategies?.join('、') || draft?.strategies?.join('、') || student.supportStrategies.join('、')
  const semesterGoal = latestGoal?.semesterGoal || draft?.semesterGoal
  const annualGoal = latestGoal?.annualGoal || draft?.semesterGoal
  const evaluationMethod = latestGoal?.evaluationMethod?.join('、') || draft?.evaluationMethods?.join('、')
  const communicationRecords = studentRecords.filter((record) => record.type === '親師溝通' && record.status === 'confirmed')
  const meetingRecords = studentRecords.filter((record) => record.status === 'confirmed' && /會議|IEP/.test(`${record.rawText} ${record.aiDraft} ${record.finalText}`))
  const transferRecords = studentRecords.filter((record) => /轉銜|交接/.test(`${record.rawText} ${record.aiDraft} ${record.finalText}`))
  const behaviorRecords = studentRecords.filter((record) => record.type === '情緒行為' && record.status === 'confirmed')

  const checklist: LawCheckItem[] = [
    {
      label: '學生能力現況',
      status: currentLevel ? '完成' : '待補',
      evidence: currentLevel || '尚未看到現況描述',
      suggestion: currentLevel ? '已可維持並更新。' : '建議補寫：「學生目前在___活動中，能在___協助下完成___。」',
    },
    {
      label: '家庭狀況與需求評估',
      status: communicationRecords.length || student.parentName || student.parentContact ? '完成' : '待補',
      evidence: communicationRecords.length ? `已有 ${communicationRecords.length} 筆親師溝通紀錄` : '尚未看到家庭需求評估資料',
      suggestion: '建議補寫：「家庭主要支持者為___，在家配合方式為___，需要學校協助事項為___。」',
    },
    {
      label: '特殊教育與支持策略',
      status: strategies ? '完成' : '待補',
      evidence: strategies || '尚未看到支持策略',
      suggestion: strategies ? '已可維持並微調。' : '建議補寫：「透過___、___與___策略支持學生學習與適應。」',
    },
    {
      label: '年度目標',
      status: annualGoal ? '完成' : '待補',
      evidence: annualGoal || '尚未看到年度目標',
      suggestion: annualGoal ? '已可維持並定期檢視。' : '建議補寫：「本學年度目標為學生在___情境下能___，達成率___。」',
    },
    {
      label: '學期目標',
      status: semesterGoal ? '完成' : '待補',
      evidence: semesterGoal || '尚未看到學期目標',
      suggestion: semesterGoal ? '已可維持並追蹤。' : '建議補寫：「本學期目標為學生在___協助下能___。」',
    },
    {
      label: '評量方式、日期與標準',
      status: evaluationMethod ? '完成' : '待補',
      evidence: evaluationMethod || '尚未看到評量方式',
      suggestion: evaluationMethod ? '已可維持並確認通知。' : '建議補寫：「採用___方式評量，於___日期檢核，標準為___。」',
    },
    {
      label: '情緒行為介入方案',
      status: behaviorRecords.length || student.status !== 'stable' ? '完成' : '待補',
      evidence: behaviorRecords.length ? `已有 ${behaviorRecords.length} 筆情緒行為紀錄` : '尚未看到情緒行為介入內容',
      suggestion: '建議補寫：「當學生情緒升高時，先採取___，再以___支持回到學習。」',
    },
    {
      label: '轉銜輔導與服務',
      status: transferRecords.length || student.supportServices.length ? '完成' : '待補',
      evidence: transferRecords.length ? `已有 ${transferRecords.length} 筆轉銜相關紀錄` : student.supportServices.length ? `已有 ${student.supportServices.length} 筆支持服務資料` : '尚未看到轉銜或支持服務資料',
      suggestion: '建議補寫：「下一階段將延續___策略，並確認家長、導師與相關人員交接。」',
    },
    {
      label: '家長 / 學生參與紀錄',
      status: communicationRecords.length || meetingRecords.length ? '完成' : '待補',
      evidence: communicationRecords.length || meetingRecords.length ? `已有 ${communicationRecords.length + meetingRecords.length} 筆參與紀錄` : '尚未看到家長或學生參與紀錄',
      suggestion: '建議補寫：「已於___時間與家長 / 學生討論，目前共識為___。」',
    },
  ]

  return checklist
}

export function IEPWorkflowPage({ role, students, records, iepGoals, saveIepGoal, updateStudent, viewerId, schoolId }: Props) {
  const visible = useMemo(() => visibleStudents(students, role, viewerId), [students, role, viewerId])
  const [studentId, setStudentId] = useState(visible[0]?.id || '')
  const [input, setInput] = useState('閱讀速度慢，理解題容易抓不到重點，上課容易分心，需要關鍵字提示。')
  const [draft, setDraft] = useState<IEPDraft | null>(null)
  const [sections, setSections] = useState<Record<SectionKey, SectionState>>(() => {
    const now = getTaipeiISOString()
    return Object.fromEntries(sectionLabels.map(([key]) => [key, { status: '未開始' as const, owner: role, updatedAt: now, content: '' }])) as Record<SectionKey, SectionState>
  })
  const selected = visible.find((student) => student.id === studentId) || visible[0]

  useEffect(() => {
    if (!visible.find((student) => student.id === studentId)) setStudentId(visible[0]?.id || '')
  }, [studentId, visible])

  useEffect(() => {
    if (!viewerId || !schoolId || !selected) return
    void createAuditLog({
      actorId: viewerId,
      schoolId,
      action: 'view_iep_workflow',
      targetTable: 'iep_goals',
      targetId: selected.id,
      metadata: { studentId: selected.id, role },
    }).catch(() => {})
  }, [role, schoolId, selected, viewerId])

  useEffect(() => {
    if (!selected) return
    const generated = generateIEPDraft(selected, input)
    setDraft(generated)
    const next = buildSectionTexts(selected, generated)
    const now = getTaipeiISOString()
    setSections((prev) => {
      const updated: Record<SectionKey, SectionState> = { ...prev }
      sectionLabels.forEach(([key]) => {
        updated[key] = {
          ...updated[key],
          content: next[key],
          owner: updated[key]?.owner || role,
          updatedAt: now,
          status: updated[key]?.status === '已確認' ? '已確認' : '草稿',
        }
      })
      return updated
    })
  }, [input, role, selected])

  const checklist = useMemo(() => (selected ? buildLawChecklist(selected, draft, iepGoals, records) : []), [draft, iepGoals, records, selected])

  const generateSectionDraft = (key: SectionKey) => {
    if (!selected) return
    const generated = generateIEPDraft(selected, input)
    const next = buildSectionTexts(selected, generated)
    const now = getTaipeiISOString()
    setDraft(generated)
    setSections((prev) => ({
      ...prev,
      [key]: {
        status: '草稿',
        owner: role,
        updatedAt: now,
        content: next[key],
      },
    }))
    if (viewerId && schoolId) {
      void createAuditLog({
        actorId: viewerId,
        schoolId,
        action: 'create_iep_draft',
        targetTable: 'iep_goals',
        targetId: `${selected.id}:${key}`,
        metadata: { studentId: selected.id, section: key },
      }).catch(() => {})
    }
  }

  const updateSection = (key: SectionKey, content: string) => {
    const now = getTaipeiISOString()
    setSections((prev) => ({
      ...prev,
      [key]: { ...prev[key], status: '草稿', owner: role, updatedAt: now, content },
    }))
    if (viewerId && schoolId && selected) {
      void createAuditLog({
        actorId: viewerId,
        schoolId,
        action: 'update_iep_section',
        targetTable: 'iep_goals',
        targetId: `${selected.id}:${key}`,
        metadata: { studentId: selected.id, section: key },
      }).catch(() => {})
    }
  }

  const confirmSection = (key: SectionKey) => {
    if (!selected) return
    const now = getTaipeiISOString()
    setSections((prev) => ({
      ...prev,
      [key]: { ...prev[key], status: '已確認', owner: role, updatedAt: now },
    }))
    if (viewerId && schoolId) {
      void createAuditLog({
        actorId: viewerId,
        schoolId,
        action: 'confirm_iep_section',
        targetTable: 'iep_goals',
        targetId: `${selected.id}:${key}`,
        metadata: { studentId: selected.id, section: key },
      }).catch(() => {})
    }
  }

  const saveWholeIep = (confirmed: boolean) => {
    if (!selected || !draft) return
    const now = getTaipeiISOString()
    saveIepGoal({
      id: crypto.randomUUID(),
      studentId: selected.id,
      domain: selected.mainNeeds[0] || '學習適應',
      currentLevel: draft.currentLevel,
      annualGoal: draft.semesterGoal,
      semesterGoal: draft.semesterGoal,
      strategies: draft.strategies,
      evaluationMethod: draft.evaluationMethods,
      aiDraft: JSON.stringify({ draft, sections }),
      confirmed,
      createdBy: role,
      confirmedBy: confirmed ? role : undefined,
      createdAt: now,
      confirmedAt: confirmed ? now : undefined,
      updatedAt: now,
    })
    if (viewerId && schoolId) {
      void createAuditLog({
        actorId: viewerId,
        schoolId,
        action: confirmed ? 'confirm_iep_section' : 'create_iep_draft',
        targetTable: 'iep_goals',
        targetId: `${selected.id}:overall`,
        metadata: { studentId: selected.id, confirmed },
      }).catch(() => {})
    }
  }

  if (role === '家長') {
    return (
      <main className="space-y-4 px-4">
        <PrivacyNotice />
        {selected ? (
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm font-bold text-teal-700">家長版摘要</p>
            <h2 className="mt-1 text-2xl font-black text-slate-900">{selected.name}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">{parentSafeText(`孩子目前正在練習${selected.mainNeeds.join('、')}。學校會持續協助，並以必要範圍提供說明。`)}</p>
            <p className="mt-3 text-sm leading-6 text-slate-700">{parentSafeText(selected.assessmentAdjustments.note || '目前以支持學習為主。')}</p>
          </section>
        ) : null}
      </main>
    )
  }

  if (role === '普通班導師' || role === '科任老師') {
    return (
      <main className="space-y-4 px-4">
        <PrivacyNotice />
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-sm font-bold text-teal-700">普通班 / 科任可見內容</p>
          <h2 className="mt-1 text-2xl font-black text-slate-900">提醒卡與評量調整</h2>
          <div className="mt-4 space-y-3">
            {visible.map((student) => (
              <div key={student.id} className="rounded-2xl bg-slate-50 p-4">
                <p className="font-black text-slate-900">{student.name}｜{student.className}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{generateTeacherTipCard(student)}</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">評量調整：{student.assessmentAdjustments.note}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    )
  }

  if (!selected) {
    return <main className="px-4"><p className="rounded-2xl bg-white p-5 text-sm font-semibold text-slate-700 shadow-sm">目前沒有可進入 IEP 的學生。</p></main>
  }

  return (
    <main className="space-y-5 px-4">
      <PrivacyNotice />
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-teal-700">IEP / 會議助手</p>
        <h2 className="mt-1 text-2xl font-black text-slate-900">{selected.name}｜流程化 IEP</h2>
        <p className="mt-2 text-sm text-slate-500">AI 草稿 → 老師編輯 → 老師確認 → 寫入正式資料與 audit logs。</p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <select value={studentId} onChange={(event) => setStudentId(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            {visible.map((student) => <option key={student.id} value={student.id}>{student.name}｜{student.className}</option>)}
          </select>
          <textarea value={input} onChange={(event) => setInput(event.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 leading-6" />
        </div>
        <button onClick={() => generateSectionDraft('currentLevel')} className="mt-3 w-full rounded-2xl bg-teal-600 px-5 py-4 text-lg font-black text-white">產生 IEP 草稿</button>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-teal-700">IEP 法規檢核表</p>
            <h3 className="mt-1 text-xl font-black text-slate-900">完成狀態與待補建議</h3>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">共 {checklist.length} 項</span>
        </div>
        <div className="mt-4 space-y-3">
          {checklist.map((item) => (
            <div key={item.label} className={`rounded-2xl border p-4 ${item.status === '完成' ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-slate-900">{item.label}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{item.evidence}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${item.status === '完成' ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'}`}>{item.status}</span>
              </div>
              <p className="mt-3 rounded-xl bg-white/80 p-3 text-sm leading-6 text-slate-700">{item.suggestion}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        {sectionLabels.map(([key, label]) => (
          <div key={key} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-black text-slate-900">{label}</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">狀態：{sections[key].status}｜負責人：{sections[key].owner}｜最後更新：{sections[key].updatedAt.slice(0, 16).replace('T', ' ')}</p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-black ${sectionTone(sections[key].status)}`}>{sections[key].status}</span>
            </div>
            <textarea
              value={sections[key].content}
              onChange={(event) => updateSection(key, event.target.value)}
              rows={key === 'meetingNotes' || key === 'semesterReview' || key === 'transfer' ? 4 : 3}
              className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6"
            />
            <div className="mt-3 grid grid-cols-3 gap-2">
              <button onClick={() => generateSectionDraft(key)} className="min-h-11 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700">一鍵產生草稿</button>
              <button onClick={() => updateSection(key, sections[key].content)} className="min-h-11 rounded-xl bg-amber-100 px-4 py-3 text-sm font-bold text-amber-900">編輯</button>
              <button onClick={() => confirmSection(key)} className="min-h-11 rounded-xl bg-teal-700 px-4 py-3 text-sm font-bold text-white">確認</button>
            </div>
          </div>
        ))}
      </section>

      {draft && (
        <section className="rounded-3xl bg-teal-50 p-5 shadow-sm">
          <p className="text-sm font-bold text-teal-900">AI 草稿，需由老師確認後才會定稿。</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-4 text-sm leading-6 text-slate-700">
              <p className="font-black text-slate-900">現況描述草稿</p>
              <p className="mt-2">{draft.currentLevel}</p>
            </div>
            <div className="rounded-2xl bg-white p-4 text-sm leading-6 text-slate-700">
              <p className="font-black text-slate-900">需求分析草稿</p>
              <p className="mt-2">{draft.needsAnalysis}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => saveWholeIep(false)} className="min-h-11 rounded-xl bg-amber-100 px-4 py-3 font-bold text-amber-900">儲存 IEP 草稿</button>
            <button onClick={() => saveWholeIep(true)} className="min-h-11 rounded-xl bg-teal-700 px-4 py-3 font-bold text-white">老師確認 IEP 草稿</button>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h3 className="text-lg font-black text-slate-900">IEP 草稿 / 已確認</h3>
        {iepGoals.filter((goal) => goal.studentId === selected.id).map((goal) => (
          <div key={goal.id} className="rounded-2xl bg-white p-4 text-sm shadow-sm">
            <p className="font-black text-slate-900">{goal.confirmed ? '已確認' : '草稿'}｜{goal.domain}</p>
            <p className="mt-2 whitespace-pre-wrap leading-6 text-slate-700">{goal.semesterGoal}</p>
          </div>
        ))}
      </section>

      {canSeeSensitive(role) && (
        <section className="rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-900">
          <b>敏感資料：</b>{selected.sensitiveNotes || '尚無'}
        </section>
      )}

      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <h3 className="text-lg font-black text-slate-900">評量調整</h3>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(['extendedTime', 'readAloud', 'separateRoom', 'reducedItems', 'alternativeAssessment', 'computerInput', 'notifiedHomeroom', 'notifiedSubjectTeachers', 'notifiedAcademicOffice'] as const).map((key) => (
            <button
              key={key}
              onClick={() => updateStudent({ ...selected, assessmentAdjustments: { ...selected.assessmentAdjustments, [key]: !selected.assessmentAdjustments[key] } })}
              className={`min-h-11 rounded-xl px-3 py-3 text-sm font-bold ${selected.assessmentAdjustments[key] ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700'}`}
            >
              {key}
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}
