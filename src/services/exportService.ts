import type { Record, Role, Student } from '../types'
import { generateSemesterSummary } from './aiService'
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
    lines.push(
      `學生基本需求：${student.mainNeeds.join('、')}`,
      `有效策略：${student.supportStrategies.join('、')}`,
      '無效策略：突然更換規則、公開責備、一次給太多指令',
      `情緒觸發點：${student.regularClassTips[0]}`,
      `家長溝通注意事項：以溫和、具體、可配合的文字說明`,
      `評量調整：${student.assessmentAdjustments.note}`,
      `支持服務：${student.supportServices.map((service) => `${service.type}(${service.status})`).join('、')}`,
      `本學期摘要：${generateSemesterSummary(safeStudent, confirmed)}`,
      '下一位老師注意事項：延續有效策略，前兩週密集觀察適應狀況。',
    )
  } else if (type === '會議前資料包') {
    lines.push(
      `本學期主要表現：${student.mainNeeds.join('、')}持續練習中`,
      `重要事件紀錄：${confirmed.map((record) => record.finalText).join('\n') || '尚無確認紀錄'}`,
      `有效支持策略：${student.supportStrategies.join('、')}`,
      `普通班回饋：${student.regularClassTips.join('、')}`,
      `評量調整狀況：${student.assessmentAdjustments.note}`,
      `下階段建議目標：${student.iepFocus.join('、')}`,
    )
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

export function studentsToCsv(students: Student[]) {
  const header = ['學生', '班級', '主要需求', '評量調整', '已通知導師', '已通知科任', '已通知教務處', '段考後檢討']
  const rows = students.map((student) => [
    student.name,
    student.className,
    student.mainNeeds.join('、'),
    student.assessmentAdjustments.note,
    student.assessmentAdjustments.notifiedHomeroom ? '是' : '否',
    student.assessmentAdjustments.notifiedSubjectTeachers ? '是' : '否',
    student.assessmentAdjustments.notifiedAcademicOffice ? '是' : '否',
    student.assessmentAdjustments.postExamReview || '未填',
  ])
  return [header, ...rows].map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',')).join('\n')
}
