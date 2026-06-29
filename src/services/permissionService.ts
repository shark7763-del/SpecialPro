import type { Record as CaseRecord, RecordType, Role, Student } from '../types'

const roleRank: globalThis.Record<Role, string> = {
  特教導師: 'special_teacher',
  特教組長: 'special_chair',
  普通班導師: 'homeroom_teacher',
  科任老師: 'subject_teacher',
  家長: 'parent',
  系統管理員: 'admin',
}

function resolveUserId(user: unknown) {
  if (typeof user === 'string') return user
  if (user && typeof user === 'object' && 'id' in user && typeof (user as { id?: unknown }).id === 'string') return (user as { id: string }).id
  return ''
}

export function canViewStudent(role: Role, user: unknown, student: Student) {
  const userId = resolveUserId(user)
  if (role === '系統管理員' || role === '特教組長') return true
  if (role === '特教導師') {
    if (userId && student.specialTeacherId) return student.specialTeacherId === userId
    return true
  }
  if (role === '普通班導師') {
    if (userId && student.homeroomTeacherId) return student.homeroomTeacherId === userId
    return ['801班', '702班', '603班'].includes(student.className)
  }
  if (role === '科任老師') {
    if (userId && Array.isArray(student.subjectTeacherIds) && student.subjectTeacherIds.length > 0) return student.subjectTeacherIds.includes(userId)
    return student.assessmentAdjustments.extendedTime || student.assessmentAdjustments.readAloud
  }
  if (role === '家長') {
    if (userId && Array.isArray(student.guardianIds) && student.guardianIds.length > 0) return student.guardianIds.includes(userId)
    return student.id === 's1'
  }
  return false
}

export function visibleStudents(students: Student[], role: Role, user?: unknown) {
  return students.filter((student) => canViewStudent(role, user, student))
}

export function canViewSensitive(role: Role) {
  return role === '特教導師' || role === '特教組長' || role === '系統管理員'
}

export const canSeeSensitive = canViewSensitive

export function canEditStudent(role: Role) {
  return role === '特教導師' || role === '特教組長' || role === '系統管理員'
}

export function canCreateRecord(role: Role, recordType: RecordType) {
  if (role === '特教導師' || role === '特教組長' || role === '系統管理員') return true
  if ((role === '普通班導師' || role === '科任老師') && recordType === '普通班回饋') return true
  return false
}

export function canEditRecords(role: Role) {
  return canCreateRecord(role, '課堂學習')
}

export function canConfirmRecord(role: Role) {
  return role === '特教導師' || role === '特教組長' || role === '系統管理員'
}

export function canExport(role: Role) {
  return role !== '家長'
}

export function canManageRoster(role: Role) {
  return role === '系統管理員' || role === '特教組長'
}

export function parentSafeText(text: string) {
  return text
    .replaceAll('紅燈', '需要一起協助')
    .replaceAll('高風險', '需要優先支持')
    .replaceAll('異常', '近期需要觀察')
    .replaceAll('問題學生', '正在練習的孩子')
    .replaceAll('問題', '目前需要協助的地方')
    .replaceAll('行為問題', '適應狀況需要協助')
    .replaceAll('情緒爆發', '情緒調節需要支持')
    .replaceAll('攻擊', '出現不適當的肢體反應')
    .replaceAll('不配合', '目前需要引導')
    .replaceAll('優先處理', '需要一起協助')
}

export function staffLimitedText(text: string) {
  return text
    .replaceAll(/家長[:：]?\S+/g, '家長聯絡資訊已遮蔽')
    .replaceAll(/病歷|診斷|醫療/g, '敏感資訊')
}

export function maskStudentForRole(student: Student, role: Role): Student {
  if (canViewSensitive(role)) return student
  return {
    ...student,
    disabilityCategory: '',
    parentName: role === '家長' ? student.parentName : '',
    parentContact: '',
    sensitiveNotes: '',
  }
}

export function maskRecordForRole(record: CaseRecord, role: Role): CaseRecord {
  if (canViewSensitive(role)) return record
  const safeText = role === '家長' ? parentSafeText(record.finalText || record.aiDraft) : staffLimitedText(record.finalText || record.aiDraft)
  return {
    ...record,
    rawText: '',
    antecedent: '',
    behavior: role === '家長' ? parentSafeText(record.behavior) : staffLimitedText(record.behavior),
    aiDraft: safeText,
    finalText: safeText,
  }
}

export function visibleRecords(records: CaseRecord[], students: Student[], role: Role, user?: unknown) {
  const ids = new Set(visibleStudents(students, role, user).map((student) => student.id))
  if (role === '普通班導師' || role === '科任老師') {
    return records.filter((record) => ids.has(record.studentId) && (record.visibility === 'staff_limited' || record.visibility === 'parent_safe' || ['普通班回饋', '評量調整'].includes(record.type))).map((record) => maskRecordForRole(record, role))
  }
  if (role === '家長') {
    return records.filter((record) => ids.has(record.studentId) && record.status === 'confirmed' && record.visibility === 'parent_safe').map((record) => maskRecordForRole(record, role))
  }
  return records.filter((record) => ids.has(record.studentId)).map((record) => maskRecordForRole(record, role))
}

export function roleCodeToDisplay(role: string): Role {
  const map: globalThis.Record<string, Role> = {
    special_teacher: '特教導師',
    special_chair: '特教組長',
    homeroom_teacher: '普通班導師',
    subject_teacher: '科任老師',
    parent: '家長',
    admin: '系統管理員',
  }
  return map[role] ?? '特教導師'
}

export function roleDisplayToCode(role: Role) {
  return roleRank[role]
}
