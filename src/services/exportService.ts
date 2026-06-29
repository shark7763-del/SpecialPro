import type { Record as CaseRecord, Role, Student } from '../types'
import { generateMeetingPackage, generateTransferPackage, generateSemesterSummary } from './aiService'
import { maskStudentForRole, parentSafeText } from './permissionService'
import { getTaipeiDateString, getTaipeiISOString } from '../utils/date'

export type ExportPackageType =
  | '個案紀錄摘要'
  | 'IEP 會議前資料包'
  | 'IEP 學期檢討摘要'
  | '普通班教師提醒卡'
  | '評量調整確認表'
  | '家長溝通紀錄摘要'
  | '轉銜交接資料包'

export interface ExportPackage {
  title: string
  filenameBase: string
  content: string
  html: string
  txt: string
  json: string
  csv: string
  safeContent: string
}

export interface EvaluationPackage {
  title: string
  filenameBase: string
  content: string
  html: string
  txt: string
  csv: string
  metrics: {
    studentCount: number
    iepCompletionRate: number
    meetingCompletionRate: number
    assessmentNotificationRate: number
    supportTrackingRate: number
    transferCoverageRate: number
    pendingCount: number
  }
}

function escapeHtml(input: string) {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function csvEscape(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

function hasMeetingDraft(record: CaseRecord) {
  const text = `${record.rawText} ${record.aiDraft} ${record.finalText} ${record.followUp}`
  return record.usageTags.includes('IEP檢討') || record.usageTags.includes('交接資料') || /會議|IEP|轉銜|交接/.test(text)
}

function hasTransferNote(record: CaseRecord) {
  const text = `${record.rawText} ${record.aiDraft} ${record.finalText} ${record.followUp}`
  return record.usageTags.includes('交接資料') || /轉銜|交接/.test(text)
}

export function getExportFilename(type: ExportPackageType, student: Student) {
  return `${getTaipeiDateString()}_${student.name}_${type}.txt`
}

export function getExportTitle(type: ExportPackageType) {
  return type
}

export function getExportAuditAction(type: ExportPackageType) {
  if (type === 'IEP 會議前資料包' || type === 'IEP 學期檢討摘要') return 'export_iep_package'
  if (type === '普通班教師提醒卡') return 'export_teacher_tip_card'
  if (type === '評量調整確認表') return 'export_assessment_adjustment'
  if (type === '家長溝通紀錄摘要') return 'export_parent_safe_package'
  if (type === '轉銜交接資料包') return 'export_transition_package'
  return 'export_case_package'
}

function makeBaseLines(type: ExportPackageType, student: Student, role: Role) {
  const safeStudent = maskStudentForRole(student, role)
  return [
    `資料類型：${type}`,
    `學生：${safeStudent.name}｜${safeStudent.className}`,
    '提醒：請確認資料使用範圍，避免分享給無關人員。',
    `產生時間：${getTaipeiISOString()}`,
    '',
  ]
}

function buildCsv(student: Student, role: Role) {
  const safe = maskStudentForRole(student, role)
  const header = ['學生', '班級', '主要需求', '評量調整', '已通知導師', '已通知科任', '已通知教務處', '段考後檢討']
  const row = [
    safe.name,
    safe.className,
    safe.mainNeeds.join('、'),
    role === '家長' ? parentSafeText(safe.assessmentAdjustments.note) : safe.assessmentAdjustments.note,
    safe.assessmentAdjustments.notifiedHomeroom ? '是' : '否',
    safe.assessmentAdjustments.notifiedSubjectTeachers ? '是' : '否',
    safe.assessmentAdjustments.notifiedAcademicOffice ? '是' : '否',
    role === '家長' ? parentSafeText(safe.assessmentAdjustments.postExamReview || '未填') : safe.assessmentAdjustments.postExamReview || '未填',
  ]
  return [header, row].map((line) => line.map(csvEscape).join(',')).join('\n')
}

export function buildReport(type: string, student: Student, records: CaseRecord[], role: Role = '特教導師') {
  const safeStudent = maskStudentForRole(student, role)
  const confirmed = records.filter((record) => record.studentId === student.id && record.status === 'confirmed')
  const lines = makeBaseLines(type as ExportPackageType, student, role)

  if (role === '家長') {
    lines.push(parentSafeText(`家長版摘要：孩子目前正在練習${student.mainNeeds.join('、')}。學校會持續協助，並以必要範圍提供說明。`))
    return lines.join('\n')
  }

  if (role === '普通班導師' || role === '科任老師') {
    lines.push(`普通班提醒卡：${student.regularClassTips.join('、')}`, `評量調整：${student.assessmentAdjustments.note}`)
    return lines.join('\n')
  }

  if (type === '轉銜交接資料包') {
    lines.push(generateTransferPackage(safeStudent, confirmed))
  } else if (type === 'IEP 會議前資料包') {
    lines.push(generateMeetingPackage(safeStudent, confirmed))
  } else if (type === 'IEP 學期檢討摘要') {
    lines.push(generateSemesterSummary(safeStudent, confirmed))
  } else if (type === '普通班教師提醒卡') {
    lines.push(`普通班提醒卡：${student.regularClassTips.join('、')}`, `普通班回饋：${confirmed.filter((record) => record.type === '普通班回饋').map((record) => record.finalText).join('\n') || '尚無確認紀錄'}`)
  } else if (type === '評量調整確認表') {
    lines.push(
      `評量調整：${student.assessmentAdjustments.note}`,
      `已通知導師：${student.assessmentAdjustments.notifiedHomeroom ? '是' : '否'}`,
      `已通知科任：${student.assessmentAdjustments.notifiedSubjectTeachers ? '是' : '否'}`,
      `已通知教務處：${student.assessmentAdjustments.notifiedAcademicOffice ? '是' : '否'}`,
    )
  } else if (type === '家長溝通紀錄摘要') {
    lines.push(`家長溝通摘要：${confirmed.filter((record) => record.type === '親師溝通').map((record) => parentSafeText(record.finalText)).join('\n') || '尚無確認紀錄'}`)
  } else {
    lines.push(
      `IEP 重點：${student.iepFocus.join('、')}`,
      `支持策略：${student.supportStrategies.join('、')}`,
      `評量調整：${student.assessmentAdjustments.note}`,
      `紀錄：${confirmed.map((record) => record.finalText).join('\n') || '尚無確認紀錄'}`,
    )
  }

  return lines.join('\n')
}

export function buildExportPackage(type: ExportPackageType, student: Student, records: CaseRecord[], role: Role = '特教導師'): ExportPackage {
  const content = buildReport(type, student, records, role)
  const safeStudent = maskStudentForRole(student, role)
  const csv = buildCsv(student, role)
  const html = `<html><head><meta charset="utf-8"><title>${escapeHtml(type)}</title></head><body><pre>${escapeHtml(content)}</pre></body></html>`
  return {
    title: getExportTitle(type),
    filenameBase: `${getTaipeiDateString()}_${safeStudent.name}_${type}`,
    content,
    safeContent: content,
    html,
    txt: content,
    json: JSON.stringify({ type, student: safeStudent, content, role, createdAt: getTaipeiISOString() }, null, 2),
    csv,
  }
}

export function downloadText(filename: string, content: string, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function studentsToCsv(students: Student[], role: Role = '特教導師') {
  const header = ['學生', '班級', '主要需求', '評量調整', '已通知導師', '已通知科任', '已通知教務處', '段考後檢討']
  const rows = students.map((student) => {
    const safe = maskStudentForRole(student, role)
    const note = role === '家長' ? parentSafeText(safe.assessmentAdjustments.note) : safe.assessmentAdjustments.note
    return [
      safe.name,
      safe.className,
      safe.mainNeeds.join('、'),
      note,
      safe.assessmentAdjustments.notifiedHomeroom ? '是' : '否',
      safe.assessmentAdjustments.notifiedSubjectTeachers ? '是' : '否',
      safe.assessmentAdjustments.notifiedAcademicOffice ? '是' : '否',
      role === '家長' ? parentSafeText(safe.assessmentAdjustments.postExamReview || '未填') : safe.assessmentAdjustments.postExamReview || '未填',
    ]
  })
  return [header, ...rows].map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n')
}

function buildEvaluationCsv(students: Student[], records: CaseRecord[], _role: Role) {
  const header = ['類別', '學生', '班級', '狀態', '說明']
  const rows: string[][] = []
  const confirmedIepStudentIds = new Set(records.filter((record) => record.status === 'confirmed' && /IEP|會議/.test(`${record.rawText} ${record.aiDraft} ${record.finalText}`)).map((record) => record.studentId))
  students.forEach((student) => {
    rows.push(['全校學生', student.name, student.className, student.rosterStatus || 'active', student.mainNeeds.join('、') || '待補'])
    rows.push(['IEP 完成', student.name, student.className, confirmedIepStudentIds.has(student.id) ? '已完成' : '待完成', student.iepFocus.join('、') || student.mainNeeds.join('、') || '待補'])
    if (!student.assessmentAdjustments.notifiedHomeroom || !student.assessmentAdjustments.notifiedSubjectTeachers || !student.assessmentAdjustments.notifiedAcademicOffice) {
      rows.push(['評量調整通知', student.name, student.className, '待通知', `導師:${student.assessmentAdjustments.notifiedHomeroom ? '是' : '否'}｜科任:${student.assessmentAdjustments.notifiedSubjectTeachers ? '是' : '否'}｜教務處:${student.assessmentAdjustments.notifiedAcademicOffice ? '是' : '否'}`])
    }
    if (student.supportServices.some((service) => service.status === '待追蹤')) {
      rows.push(['支持服務追蹤', student.name, student.className, '待追蹤', student.supportServices.filter((service) => service.status === '待追蹤').map((service) => `${service.type}｜${service.nextFollowUpDate || '未填'}`).join('；')])
    }
    if (!records.some((record) => record.studentId === student.id && hasTransferNote(record))) {
      rows.push(['轉銜資料', student.name, student.className, '待補', '尚未看到轉銜或交接相關紀錄'])
    }
  })
  const completedMeetings = records.filter((record) => record.status === 'confirmed' && hasMeetingDraft(record))
  const pendingRecords = records.filter((record) => record.status === 'ai_draft' || record.status === 'teacher_draft')
  rows.push(['統計', '全校', '全部', 'IEP完成率', `${confirmedIepStudentIds.size}/${students.length || 1}`])
  rows.push(['統計', '全校', '全部', '會議紀錄完成率', `${completedMeetings.length}/${Math.max(records.filter(hasMeetingDraft).length, 1)}`])
  rows.push(['統計', '全校', '全部', '待辦數', String(pendingRecords.length)])
  return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n')
}

export function buildEvaluationPackage(students: Student[], records: CaseRecord[], role: Role = '系統管理員'): EvaluationPackage {
  const confirmedIepStudentIds = new Set(records.filter((record) => record.status === 'confirmed' && /IEP|會議/.test(`${record.rawText} ${record.aiDraft} ${record.finalText}`)).map((record) => record.studentId))
  const meetingRecords = records.filter(hasMeetingDraft)
  const completedMeetings = meetingRecords.filter((record) => record.status === 'confirmed')
  const assessmentPending = students.filter((student) => !student.assessmentAdjustments.notifiedHomeroom || !student.assessmentAdjustments.notifiedSubjectTeachers || !student.assessmentAdjustments.notifiedAcademicOffice)
  const supportPending = students.filter((student) => student.supportServices.some((service) => service.status === '待追蹤'))
  const transferPending = students.filter((student) => !records.some((record) => record.studentId === student.id && hasTransferNote(record)))
  const pendingRecords = records.filter((record) => record.status === 'ai_draft' || record.status === 'teacher_draft')

  const iepCompletionRate = Math.round((confirmedIepStudentIds.size / Math.max(students.length, 1)) * 100)
  const meetingCompletionRate = Math.round((completedMeetings.length / Math.max(meetingRecords.length, 1)) * 100)
  const assessmentNotificationRate = Math.round(((students.length - assessmentPending.length) / Math.max(students.length, 1)) * 100)
  const supportTrackingRate = Math.round(((students.length - supportPending.length) / Math.max(students.length, 1)) * 100)
  const transferCoverageRate = Math.round(((students.length - transferPending.length) / Math.max(students.length, 1)) * 100)

  const lines = [
    'SpecialPro 評鑑資料包',
    `產生時間：${getTaipeiISOString()}`,
    `檢視角色：${role}`,
    '',
    `全校特教學生清冊：${students.length} 人`,
    `IEP 完成率：${confirmedIepStudentIds.size}/${students.length || 1}（${iepCompletionRate}%）`,
    `會議紀錄完成率：${completedMeetings.length}/${Math.max(meetingRecords.length, 1)}（${meetingCompletionRate}%）`,
    `評量調整通知完成率：${students.length - assessmentPending.length}/${students.length || 1}（${assessmentNotificationRate}%）`,
    `支持服務追蹤完成率：${students.length - supportPending.length}/${students.length || 1}（${supportTrackingRate}%）`,
    `轉銜資料完成率：${students.length - transferPending.length}/${students.length || 1}（${transferCoverageRate}%）`,
    `未完成事項：${pendingRecords.length + assessmentPending.length + supportPending.length + transferPending.length} 項`,
    '',
    '一、全校特教學生清冊',
    ...students.map((student) => `- ${student.name}｜${student.className}｜${student.mainNeeds.join('、') || '待補'}｜${student.status}`),
    '',
    '二、IEP 完成率統計',
    ...students.map((student) => `- ${student.name}：${confirmedIepStudentIds.has(student.id) ? '已完成' : '待完成'}｜IEP 重點：${student.iepFocus.join('、') || '待補'}`),
    '',
    '三、會議紀錄完成率',
    ...meetingRecords.map((record) => `- ${students.find((student) => student.id === record.studentId)?.name || '未知'}｜${record.status === 'confirmed' ? '已確認' : '待定稿'}｜${record.finalText || record.aiDraft}`),
    '',
    '四、評量調整通知清冊',
    ...assessmentPending.map((student) => `- ${student.name}｜導師:${student.assessmentAdjustments.notifiedHomeroom ? '是' : '否'}｜科任:${student.assessmentAdjustments.notifiedSubjectTeachers ? '是' : '否'}｜教務處:${student.assessmentAdjustments.notifiedAcademicOffice ? '是' : '否'}`),
    '',
    '五、支持服務追蹤清冊',
    ...supportPending.map((student) => `- ${student.name}｜${student.supportServices.filter((service) => service.status === '待追蹤').map((service) => `${service.type}(${service.nextFollowUpDate || '未填'})`).join('、')}`),
    '',
    '六、轉銜資料清冊',
    ...transferPending.map((student) => `- ${student.name}｜${student.className}｜尚待補充轉銜或交接紀錄`),
    '',
    '七、未完成事項清單',
    ...pendingRecords.map((record) => `- ${students.find((student) => student.id === record.studentId)?.name || '未知'}｜${record.type}｜${record.status}`),
    ...(assessmentPending.length ? assessmentPending.map((student) => `- ${student.name}｜評量調整通知尚未完成`) : []),
    ...(supportPending.length ? supportPending.map((student) => `- ${student.name}｜支持服務追蹤尚未完成`) : []),
    ...(transferPending.length ? transferPending.map((student) => `- ${student.name}｜轉銜資料尚未完成`) : []),
    '',
    '提醒：此包目前提供 CSV 與文字報表，PDF 為 TODO。',
  ]

  const content = lines.join('\n')
  return {
    title: '評鑑資料包',
    filenameBase: `${getTaipeiDateString()}_評鑑資料包`,
    content,
    html: `<html><head><meta charset="utf-8"><title>評鑑資料包</title></head><body><pre>${escapeHtml(content)}</pre></body></html>`,
    txt: content,
    csv: buildEvaluationCsv(students, records, role),
    metrics: {
      studentCount: students.length,
      iepCompletionRate,
      meetingCompletionRate,
      assessmentNotificationRate,
      supportTrackingRate,
      transferCoverageRate,
      pendingCount: pendingRecords.length + assessmentPending.length + supportPending.length + transferPending.length,
    },
  }
}
