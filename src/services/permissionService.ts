import type { Record, Role, Student } from '../types'

export function visibleStudents(students: Student[], role: Role) {
  if (role === '家長') return students.slice(0, 1)
  if (role === '普通班導師') return students.filter((student) => ['801班', '702班', '603班'].includes(student.className))
  if (role === '科任老師') return students.filter((student) => student.assessmentAdjustments.extendedTime || student.assessmentAdjustments.readAloud)
  return students
}

export function canSeeSensitive(role: Role) {
  return role === '特教導師' || role === '特教組長'
}

export function canEditRecords(role: Role) {
  return role === '特教導師'
}

export function visibleRecords(records: Record[], students: Student[], role: Role) {
  const ids = new Set(visibleStudents(students, role).map((student) => student.id))
  if (role === '普通班導師' || role === '科任老師') return records.filter((record) => ids.has(record.studentId) && ['普通班回饋', '評量調整'].includes(record.type))
  if (role === '家長') return records.filter((record) => ids.has(record.studentId) && record.status === 'confirmed' && record.type === '親師溝通')
  return records.filter((record) => ids.has(record.studentId))
}

export function parentSafeText(text: string) {
  return text
    .replaceAll('紅燈', '需要一起協助')
    .replaceAll('高風險', '需要持續觀察')
    .replaceAll('異常', '需要觀察')
    .replaceAll('問題學生', '正在練習的孩子')
    .replaceAll('行為問題', '需要練習的表現')
    .replaceAll('優先處理', '需要一起協助')
}
