export type Role = '特教導師' | '特教組長' | '普通班導師' | '科任老師' | '家長' | '系統管理員'

export type RoleCode = 'special_teacher' | 'special_chair' | 'homeroom_teacher' | 'subject_teacher' | 'parent' | 'admin'

export type RecordStatus = 'ai_draft' | 'teacher_draft' | 'confirmed' | 'archived'

export type RecordVisibility = 'special_only' | 'staff_limited' | 'parent_safe'

export type StudentStatus = 'stable' | 'observe' | 'support' | 'urgent'

export type RecordType =
  | '課堂學習'
  | '情緒行為'
  | '親師溝通'
  | '普通班回饋'
  | '支持服務追蹤'
  | '評量調整'
  | '其他'

export type UsageTag =
  | 'IEP檢討'
  | '家長溝通'
  | '普通班合作'
  | '情緒行為追蹤'
  | '學期摘要'
  | '交接資料'

export interface Student {
  id: string
  name: string
  className: string
  grade: number
  homeroomTeacher: string
  specialTeacher: string
  disabilityCategory: string
  mainNeeds: string[]
  status: StudentStatus
  parentName: string
  parentContact: string
  iepFocus: string[]
  supportStrategies: string[]
  regularClassTips: string[]
  assessmentAdjustments: AssessmentAdjustment
  supportServices: SupportService[]
  sensitiveNotes: string
  createdAt: string
  updatedAt: string
}

export interface Record {
  id: string
  studentId: string
  date: string
  time: string
  location: string
  type: RecordType
  rawText: string
  aiDraft: string
  finalText: string
  antecedent: string
  behavior: string
  intervention: string
  result: string
  followUp: string
  parentNotified: boolean
  usageTags: UsageTag[]
  status: RecordStatus
  createdBy: Role
  createdAt: string
  confirmedAt?: string
  visibility?: RecordVisibility
  confirmedBy?: Role | string
}

export interface IEPGoal {
  id: string
  studentId: string
  domain: string
  currentLevel: string
  annualGoal: string
  semesterGoal: string
  strategies: string[]
  evaluationMethod: string[]
  aiDraft: string
  confirmed: boolean
  createdBy?: Role | string
  confirmedBy?: Role | string
  createdAt?: string
  confirmedAt?: string
  updatedAt: string
}

export interface AssessmentAdjustment {
  studentId: string
  examName: string
  extendedTime: boolean
  readAloud: boolean
  separateRoom: boolean
  reducedItems: boolean
  alternativeAssessment: boolean
  computerInput: boolean
  note: string
  notifiedHomeroom: boolean
  notifiedSubjectTeachers: boolean
  notifiedAcademicOffice: boolean
  postExamReview: string
}

export interface SupportService {
  id: string
  studentId: string
  type: string
  status: '進行中' | '待追蹤' | '已完成'
  startDate: string
  endDate: string
  note: string
  nextFollowUpDate: string
}

export interface Meeting {
  id: string
  studentId: string
  type: string
  date: string
  participants: string[]
  summary: string
  actionItems: string[]
  aiDraft: string
  confirmed: boolean
}

export interface ExportReport {
  id: string
  type: string
  studentId: string
  content: string
  createdAt: string
}

export interface AuditLog {
  id: string
  userRole: Role
  action: string
  targetType: string
  targetId: string
  createdAt: string
}

export interface IEPDraft {
  currentLevel: string
  needsAnalysis: string
  semesterGoal: string
  strategies: string[]
  evaluationMethods: string[]
  reviewSummary: string
  parentExplanation: string
  meetingPackage: string
}
