import { supabase } from './supabaseClient'
import type { AuditLog, RosterProfile, Student, StudentGuardianRow, StudentTeacherAccessRow } from '../types'

export interface RosterData {
  profiles: RosterProfile[]
  students: Student[]
  teacherAccess: StudentTeacherAccessRow[]
  guardians: StudentGuardianRow[]
  auditLogs: AuditLog[]
}

interface DbStudent {
  id: string
  school_id: string | null
  display_code: string
  class_name: string
  grade: string | null
  seat_no: string | null
  main_need: string | null
  support_level: string | null
  roster_status: 'active' | 'inactive' | 'graduated' | 'transferred' | null
  homeroom_teacher_id: string | null
  special_teacher_id: string | null
  status: 'stable' | 'observe' | 'support' | 'urgent' | null
  main_needs: string[]
  iep_focus: string[]
  support_strategies: string[]
  regular_class_tips: string[]
  created_at: string
  updated_at: string
}

interface DbProfile {
  id: string
  school_id: string | null
  email: string | null
  role: string
  display_name: string
  class_name: string | null
  subject_name: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface DbTeacherAccess {
  student_id: string
  teacher_id: string
  access_type: 'special' | 'homeroom' | 'subject' | 'viewer'
  is_active: boolean
}

interface DbGuardian {
  student_id: string
  guardian_id: string
  relationship: string | null
  is_active: boolean
}

interface DbAuditLog {
  id: string
  actor_id: string | null
  action: string
  target_table: string | null
  target_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

function assertClient() {
  if (!supabase) throw new Error('Supabase 尚未設定。')
  return supabase
}

export async function loadRosterData(): Promise<RosterData> {
  const client = assertClient()
  const [{ data: studentRows, error: studentError }, { data: profileRows, error: profileError }, { data: accessRows, error: accessError }, { data: guardianRows, error: guardianError }, { data: logRows, error: logError }] = await Promise.all([
    client.from('students').select('*').order('class_name'),
    client.from('profiles').select('*').order('display_name'),
    client.from('student_teacher_access').select('*'),
    client.from('student_guardians').select('*'),
    client.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100),
  ])

  if (studentError) throw studentError
  if (profileError) throw profileError
  if (accessError) throw accessError
  if (guardianError) throw guardianError
  if (logError) throw logError

  return {
    students: (studentRows ?? []).map((row: DbStudent) => ({
      id: row.id,
      name: row.display_code,
      className: row.class_name,
      grade: Number(row.grade || 0),
      seatNo: row.seat_no ?? '',
      mainNeed: row.main_need ?? row.main_needs?.[0] ?? '',
      supportLevel: row.support_level ?? '',
      rosterStatus: row.roster_status ?? 'active',
      homeroomTeacher: '',
      specialTeacher: '',
      disabilityCategory: '',
      mainNeeds: row.main_needs ?? [],
      status: row.status ?? 'stable',
      parentName: '',
      parentContact: '',
      iepFocus: row.iep_focus ?? [],
      supportStrategies: row.support_strategies ?? [],
      regularClassTips: row.regular_class_tips ?? [],
      assessmentAdjustments: {
        studentId: row.id,
        examName: '',
        extendedTime: false,
        readAloud: false,
        separateRoom: false,
        reducedItems: false,
        alternativeAssessment: false,
        computerInput: false,
        note: '',
        notifiedHomeroom: false,
        notifiedSubjectTeachers: false,
        notifiedAcademicOffice: false,
        postExamReview: '',
      },
      supportServices: [],
      sensitiveNotes: '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    profiles: (profileRows ?? []).map((row: DbProfile) => ({
      id: row.id,
      schoolId: row.school_id,
      email: row.email,
      role: row.role as RosterProfile['role'],
      displayName: row.display_name,
      className: row.class_name,
      subjectName: row.subject_name,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    teacherAccess: (accessRows ?? []).map((row: DbTeacherAccess) => ({
      studentId: row.student_id,
      teacherId: row.teacher_id,
      accessType: row.access_type,
      isActive: row.is_active,
    })),
    guardians: (guardianRows ?? []).map((row: DbGuardian) => ({
      studentId: row.student_id,
      guardianId: row.guardian_id,
      relationship: row.relationship,
      isActive: row.is_active,
    })),
    auditLogs: (logRows ?? []).map((row: DbAuditLog) => ({
      id: row.id,
      userRole: '系統管理員',
      action: row.action,
      targetType: row.target_table || '',
      targetId: row.target_id || '',
      createdAt: row.created_at,
    })),
  }
}

export async function getAuthUserIdByEmail(email: string) {
  const client = assertClient()
  const { data, error } = await client.rpc('lookup_auth_user_id_by_email', { input_email: email.trim() })
  if (error) throw error
  return data as string | null
}

export async function createAuditLog(params: {
  actorId: string
  schoolId: string
  action: string
  targetTable: string
  targetId: string
  metadata?: Record<string, unknown>
}) {
  const client = assertClient()
  const { error } = await client.from('audit_logs').insert({
    actor_id: params.actorId,
    school_id: params.schoolId,
    action: params.action,
    target_table: params.targetTable,
    target_id: params.targetId,
    metadata: params.metadata ?? {},
  })
  if (error) throw error
}

export async function createStudentRow(input: {
  schoolId: string
  displayCode: string
  grade: string
  className: string
  seatNo?: string
  mainNeed?: string
  supportLevel?: string
  rosterStatus?: 'active' | 'inactive' | 'graduated' | 'transferred'
  homeroomTeacherId?: string | null
  specialTeacherId?: string | null
  status?: 'stable' | 'observe' | 'support' | 'urgent'
  mainNeeds?: string[]
  iepFocus?: string[]
  supportStrategies?: string[]
  regularClassTips?: string[]
  actorId: string
}) {
  const client = assertClient()
  const payload = {
    school_id: input.schoolId,
    display_code: input.displayCode,
    class_name: input.className,
    grade: input.grade,
    seat_no: input.seatNo || null,
    main_need: input.mainNeed || null,
    support_level: input.supportLevel || null,
    roster_status: input.rosterStatus || 'active',
    homeroom_teacher_id: input.homeroomTeacherId || null,
    special_teacher_id: input.specialTeacherId || null,
    status: input.status || 'stable',
    main_needs: input.mainNeeds && input.mainNeeds.length ? input.mainNeeds : input.mainNeed ? [input.mainNeed] : [],
    iep_focus: input.iepFocus || [],
    support_strategies: input.supportStrategies || [],
    regular_class_tips: input.regularClassTips || [],
  }
  const { data, error } = await client.from('students').insert(payload).select('*').single()
  if (error) throw error
  await createAuditLog({
    actorId: input.actorId,
    schoolId: input.schoolId,
    action: 'create_student',
    targetTable: 'students',
    targetId: data.id,
    metadata: { display_code: input.displayCode, class_name: input.className },
  })
  return data as DbStudent
}

export async function updateStudentRow(input: {
  id: string
  schoolId: string
  actorId: string
  patch: Partial<{
    displayCode: string
    grade: string
    className: string
    seatNo: string
    mainNeed: string
    supportLevel: string
    rosterStatus: 'active' | 'inactive' | 'graduated' | 'transferred'
    status: 'stable' | 'observe' | 'support' | 'urgent'
  }>
}) {
  const client = assertClient()
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.patch.displayCode !== undefined) payload.display_code = input.patch.displayCode
  if (input.patch.grade !== undefined) payload.grade = input.patch.grade
  if (input.patch.className !== undefined) payload.class_name = input.patch.className
  if (input.patch.seatNo !== undefined) payload.seat_no = input.patch.seatNo
  if (input.patch.mainNeed !== undefined) payload.main_need = input.patch.mainNeed
  if (input.patch.supportLevel !== undefined) payload.support_level = input.patch.supportLevel
  if (input.patch.rosterStatus !== undefined) payload.roster_status = input.patch.rosterStatus
  if (input.patch.status !== undefined) payload.status = input.patch.status
  const { data, error } = await client.from('students').update(payload).eq('id', input.id).select('*').single()
  if (error) throw error
  await createAuditLog({
    actorId: input.actorId,
    schoolId: input.schoolId,
    action: 'update_student',
    targetTable: 'students',
    targetId: input.id,
    metadata: input.patch,
  })
  return data as DbStudent
}

export async function createProfileRow(input: {
  schoolId: string
  actorId: string
  email: string
  role: RosterProfile['role']
  displayName: string
  className?: string | null
  subjectName?: string | null
  isActive?: boolean
}) {
  const client = assertClient()
  const authUserId = await getAuthUserIdByEmail(input.email)
  if (!authUserId) throw new Error('找不到對應的 Supabase Auth 使用者，請先在 Authentication 建立帳號。')
  const { data, error } = await client.from('profiles').upsert({
    id: authUserId,
    school_id: input.schoolId,
    email: input.email,
    role: input.role,
    display_name: input.displayName,
    class_name: input.className || null,
    subject_name: input.subjectName || null,
    is_active: input.isActive ?? true,
    updated_at: new Date().toISOString(),
  }).select('*').single()
  if (error) throw error
  await createAuditLog({
    actorId: input.actorId,
    schoolId: input.schoolId,
    action: 'create_profile',
    targetTable: 'profiles',
    targetId: data.id,
    metadata: { email: input.email, role: input.role },
  })
  return data as DbProfile
}

export async function setProfileActive(input: {
  id: string
  schoolId: string
  actorId: string
  isActive: boolean
}) {
  const client = assertClient()
  const { data, error } = await client.from('profiles').update({
    is_active: input.isActive,
    updated_at: new Date().toISOString(),
  }).eq('id', input.id).select('*').single()
  if (error) throw error
  await createAuditLog({
    actorId: input.actorId,
    schoolId: input.schoolId,
    action: 'update_profile',
    targetTable: 'profiles',
    targetId: input.id,
    metadata: { isActive: input.isActive },
  })
  return data as DbProfile
}

export async function upsertTeacherAccess(input: {
  schoolId: string
  actorId: string
  studentId: string
  teacherId: string
  accessType: 'special' | 'homeroom' | 'subject' | 'viewer'
  isActive: boolean
}) {
  const client = assertClient()
  const { data, error } = await client.from('student_teacher_access').upsert({
    student_id: input.studentId,
    teacher_id: input.teacherId,
    access_type: input.accessType,
    is_active: input.isActive,
  }).select('*').single()
  if (error) throw error
  await createAuditLog({
    actorId: input.actorId,
    schoolId: input.schoolId,
    action: input.isActive ? 'bind_teacher_to_student' : 'unbind_user_from_student',
    targetTable: 'student_teacher_access',
    targetId: `${input.studentId}:${input.teacherId}`,
    metadata: { accessType: input.accessType, isActive: input.isActive },
  })
  return data as DbTeacherAccess
}

export async function upsertGuardianAccess(input: {
  schoolId: string
  actorId: string
  studentId: string
  guardianId: string
  relationship: string
  isActive: boolean
}) {
  const client = assertClient()
  const { data, error } = await client.from('student_guardians').upsert({
    student_id: input.studentId,
    guardian_id: input.guardianId,
    relationship: input.relationship,
    is_active: input.isActive,
  }).select('*').single()
  if (error) throw error
  await createAuditLog({
    actorId: input.actorId,
    schoolId: input.schoolId,
    action: input.isActive ? 'bind_parent_to_student' : 'unbind_user_from_student',
    targetTable: 'student_guardians',
    targetId: `${input.studentId}:${input.guardianId}`,
    metadata: { relationship: input.relationship, isActive: input.isActive },
  })
  return data as DbGuardian
}
