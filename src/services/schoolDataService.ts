import type { AssessmentAdjustment, IEPGoal, Record, Student, SupportService } from '../types'
import { supabase } from './supabaseClient'

interface DbStudent {
  id: string
  display_code: string
  class_name: string
  grade: string | null
  seat_no: string | null
  main_need: string | null
  support_level: string | null
  roster_status: 'active' | 'inactive' | 'graduated' | 'transferred' | null
  homeroom_teacher_id: string | null
  special_teacher_id: string | null
  status: 'stable' | 'observe' | 'support' | 'urgent'
  main_needs: string[]
  iep_focus: string[]
  support_strategies: string[]
  regular_class_tips: string[]
  created_at: string
  updated_at: string
}

interface DbAssessment {
  student_id: string
  exam_name: string | null
  extended_time: boolean
  read_aloud: boolean
  separate_room: boolean
  reduced_items: boolean
  alternative_assessment: boolean
  computer_input: boolean
  note: string | null
  notified_homeroom: boolean
  notified_subject_teachers: boolean
  notified_academic_office: boolean
  post_exam_review: string | null
}

interface DbProfile {
  id: string
  display_name: string
  role: string
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
  is_active: boolean
}

interface DbSupportService {
  id: string
  student_id: string
  service_type: string | null
  status: '進行中' | '待追蹤' | '已完成' | string | null
  start_date: string | null
  end_date: string | null
  note: string | null
  next_follow_up_date: string | null
}

export async function loadSchoolData() {
  if (!supabase) return { students: [], records: [], iepGoals: [] }
  const [{ data: students }, { data: adjustments }, { data: records }, { data: ieps }, { data: profiles }, { data: teacherAccess }, { data: guardians }, { data: services }] = await Promise.all([
    supabase.from('students').select('*').order('class_name'),
    supabase.from('assessment_adjustments').select('*'),
    supabase.from('case_records').select('*').order('created_at', { ascending: false }),
    supabase.from('iep_goals').select('*').order('updated_at', { ascending: false }),
    supabase.from('profiles').select('id, display_name, role'),
    supabase.from('student_teacher_access').select('*'),
    supabase.from('student_guardians').select('*'),
    supabase.from('support_services').select('*'),
  ])

  const adjustmentMap = new Map((adjustments as DbAssessment[] | null ?? []).map((item) => [item.student_id, item]))
  const profileMap = new Map((profiles as DbProfile[] | null ?? []).map((item) => [item.id, item]))
  const teacherAccessMap = new Map<string, DbTeacherAccess[]>()
  ;(teacherAccess as DbTeacherAccess[] | null ?? []).forEach((item) => {
    const list = teacherAccessMap.get(item.student_id) || []
    list.push(item)
    teacherAccessMap.set(item.student_id, list)
  })
  const guardianMap = new Map<string, DbGuardian[]>()
  ;(guardians as DbGuardian[] | null ?? []).forEach((item) => {
    const list = guardianMap.get(item.student_id) || []
    list.push(item)
    guardianMap.set(item.student_id, list)
  })
  const serviceMap = new Map<string, SupportService[]>()
  ;(services as DbSupportService[] | null ?? []).forEach((item) => {
    const list = serviceMap.get(item.student_id) || []
    list.push({
      id: item.id,
      studentId: item.student_id,
      type: item.service_type || '',
      status: (item.status as SupportService['status']) || '進行中',
      startDate: item.start_date || '',
      endDate: item.end_date || '',
      note: item.note || '',
      nextFollowUpDate: item.next_follow_up_date || '',
    })
    serviceMap.set(item.student_id, list)
  })
  return {
    students: (students as DbStudent[] | null ?? []).map((student) => {
      const adjustment = adjustmentMap.get(student.id)
      const accessRows = teacherAccessMap.get(student.id) || []
      const guardianRows = guardianMap.get(student.id) || []
      const specialTeacherId = accessRows.find((item) => item.access_type === 'special' && item.is_active)?.teacher_id || student.special_teacher_id || undefined
      const homeroomTeacherId = accessRows.find((item) => item.access_type === 'homeroom' && item.is_active)?.teacher_id || student.homeroom_teacher_id || undefined
      const subjectTeacherIds = accessRows.filter((item) => item.access_type === 'subject' && item.is_active).map((item) => item.teacher_id)
      const guardianIds = guardianRows.filter((item) => item.is_active).map((item) => item.guardian_id)
      return {
        id: student.id,
        name: student.display_code,
        className: student.class_name,
        grade: Number(student.grade || 0),
        seatNo: student.seat_no ?? '',
        mainNeed: student.main_need ?? student.main_needs?.[0] ?? '',
        supportLevel: student.support_level ?? '',
        rosterStatus: student.roster_status ?? 'active',
        homeroomTeacherId,
        specialTeacherId,
        subjectTeacherIds,
        guardianIds,
        homeroomTeacher: homeroomTeacherId ? profileMap.get(homeroomTeacherId)?.display_name || '' : '',
        specialTeacher: specialTeacherId ? profileMap.get(specialTeacherId)?.display_name || '' : '',
        disabilityCategory: '',
        mainNeeds: student.main_needs ?? [],
        status: student.status,
        parentName: guardianIds.map((id) => profileMap.get(id)?.display_name || '').filter(Boolean).join('、'),
        parentContact: '',
        iepFocus: student.iep_focus ?? [],
        supportStrategies: student.support_strategies ?? [],
        regularClassTips: student.regular_class_tips ?? [],
        assessmentAdjustments: {
          studentId: student.id,
          examName: adjustment?.exam_name ?? '',
          extendedTime: adjustment?.extended_time ?? false,
          readAloud: adjustment?.read_aloud ?? false,
          separateRoom: adjustment?.separate_room ?? false,
          reducedItems: adjustment?.reduced_items ?? false,
          alternativeAssessment: adjustment?.alternative_assessment ?? false,
          computerInput: adjustment?.computer_input ?? false,
          note: adjustment?.note ?? '',
          notifiedHomeroom: adjustment?.notified_homeroom ?? false,
          notifiedSubjectTeachers: adjustment?.notified_subject_teachers ?? false,
          notifiedAcademicOffice: adjustment?.notified_academic_office ?? false,
          postExamReview: adjustment?.post_exam_review ?? '',
        },
        supportServices: serviceMap.get(student.id) || [],
        sensitiveNotes: '',
        createdAt: student.created_at,
        updatedAt: student.updated_at,
      } satisfies Student
    }),
    records: (records ?? []).map((record: any) => ({
      id: record.id,
      studentId: record.student_id,
      date: String(record.created_at).slice(0, 10),
      time: String(record.created_at).slice(11, 16),
      location: '',
      type: record.record_type,
      rawText: record.raw_text ?? '',
      aiDraft: record.ai_draft ?? '',
      finalText: record.final_text ?? '',
      antecedent: record.antecedent ?? '',
      behavior: record.behavior ?? '',
      intervention: record.intervention ?? '',
      result: record.result ?? '',
      followUp: record.follow_up ?? '',
      parentNotified: record.parent_notified ?? false,
      usageTags: record.usage_tags ?? [],
      status: record.status,
      createdBy: '特教導師',
      createdAt: record.created_at,
      confirmedAt: record.confirmed_at ?? undefined,
      visibility: record.visibility,
    })) as Record[],
    iepGoals: (ieps ?? []).map((goal: any) => ({
      id: goal.id,
      studentId: goal.student_id,
      domain: goal.domain ?? '',
      currentLevel: goal.current_level ?? '',
      annualGoal: goal.annual_goal ?? '',
      semesterGoal: goal.semester_goal ?? '',
      strategies: goal.strategies ?? [],
      evaluationMethod: goal.evaluation_method ? [goal.evaluation_method] : [],
      aiDraft: JSON.stringify(goal.ai_draft ?? {}),
      confirmed: goal.confirmed ?? false,
      createdBy: goal.created_by ?? '',
      confirmedBy: goal.confirmed_by ?? '',
      createdAt: goal.created_at,
      confirmedAt: goal.confirmed_at ?? undefined,
      updatedAt: goal.updated_at,
    })) as IEPGoal[],
  }
}

export async function saveSchoolRecord(record: Record, schoolId: string, actorId: string) {
  if (!supabase) return
  const { error } = await supabase.from('case_records').upsert({
    id: record.id,
    school_id: schoolId,
    student_id: record.studentId,
    record_type: record.type,
    raw_text: record.rawText,
    ai_draft: record.aiDraft,
    final_text: record.finalText,
    antecedent: record.antecedent,
    behavior: record.behavior,
    intervention: record.intervention,
    result: record.result,
    follow_up: record.followUp,
    parent_notified: record.parentNotified,
    usage_tags: record.usageTags,
    status: record.status,
    visibility: record.visibility || 'special_only',
    created_by: actorId,
    confirmed_by: record.confirmedBy || null,
    confirmed_at: record.confirmedAt || null,
    updated_at: record.confirmedAt || record.createdAt,
  })
  if (error) throw error
}

export async function saveSchoolIepGoal(goal: IEPGoal, schoolId: string, actorId: string) {
  if (!supabase) return
  const { error } = await supabase.from('iep_goals').upsert({
    id: goal.id,
    school_id: schoolId,
    student_id: goal.studentId,
    domain: goal.domain,
    current_level: goal.currentLevel,
    annual_goal: goal.annualGoal,
    semester_goal: goal.semesterGoal,
    strategies: goal.strategies,
    evaluation_method: goal.evaluationMethod.join('、'),
    ai_draft: typeof goal.aiDraft === 'string' ? JSON.parse(goal.aiDraft || '{}') : goal.aiDraft,
    confirmed: goal.confirmed,
    created_by: actorId,
    confirmed_by: goal.confirmedBy || null,
    confirmed_at: goal.confirmedAt || null,
    updated_at: goal.updatedAt,
  })
  if (error) throw error
}

export async function saveAssessmentAdjustment(studentId: string, adjustment: AssessmentAdjustment, schoolId: string, actorId: string) {
  if (!supabase) return
  const { error } = await supabase.from('assessment_adjustments').upsert({
    student_id: studentId,
    school_id: schoolId,
    exam_name: adjustment.examName || null,
    extended_time: adjustment.extendedTime,
    read_aloud: adjustment.readAloud,
    separate_room: adjustment.separateRoom,
    reduced_items: adjustment.reducedItems,
    alternative_assessment: adjustment.alternativeAssessment,
    computer_input: adjustment.computerInput,
    note: adjustment.note || null,
    notified_homeroom: adjustment.notifiedHomeroom,
    notified_subject_teachers: adjustment.notifiedSubjectTeachers,
    notified_academic_office: adjustment.notifiedAcademicOffice,
    post_exam_review: adjustment.postExamReview || null,
    created_by: actorId,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}
