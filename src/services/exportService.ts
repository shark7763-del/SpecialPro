import type { Record, Role, Student } from '../types'
import { generateMeetingPackage, generateTransferPackage } from './aiService'
import { maskStudentForRole, parentSafeText } from './permissionService'

export function buildReport(type: string, student: Student, records: Record[], role: Role = '特教導師') {
  const safeStudent = maskStudentForRole(student, role)
  const confirmed = records.filter((record) => record.studentId === student.id && record.status === 'confirmed')
  const lines = [
    `資料類型：${type}`,
    `學生：${safeStudent.name}｜${safeStudent.className}`,
    '提醒：請確認資料使用範圍，避免分享給無關人員。',
    '',
  ]

  if (role === '家長') {
    lines.push(parentSafeText(`家長版摘要：孩子目前正在練習${student.mainNeeds.join('、')}。學校會持續協助，並以必要範圍提供說明。`))
    return lines.join('\n')
  }

  if (role === '普通班導師' || role === '科任老師') {
    lines.push(`普通班提醒卡：${student.regularClassTips.join('、')}`, `評量調整：${student.assessmentAdjustments.note}`)
    return lines.join('\n')
  }

  if (type === '交接資料包') {
    lines.push(generateTransferPackage(safeStudent, confirmed))
  } else if (type === '會議前資料包') {
    lines.push(generateMeetingPackage(safeStudent, confirmed))
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
