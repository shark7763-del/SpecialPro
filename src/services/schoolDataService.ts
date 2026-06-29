import type { IEPGoal, Record, Student } from '../types'
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

export async function loadSchoolData() {
  if (!supabase) return { students: [], records: [], iepGoals: [] }
  const [{ data: students }, { data: adjustments }, { data: records }, { data: ieps }] = await Promise.all([
    supabase.from('students').select('*').order('class_name'),
    supabase.from('assessment_adjustments').select('*'),
    supabase.from('case_records').select('*').order('created_at', { ascending: false }),
    supabase.from('iep_goals').select('*').order('updated_at', { ascending: false }),
  ])

  const adjustmentMap = new Map((adjustments as DbAssessment[] | null ?? []).map((item) => [item.student_id, item]))
  return {
    students: (students as DbStudent[] | null ?? []).map((student) => {
      const adjustment = adjustmentMap.get(student.id)
      return {
        id: student.id,
        name: student.display_code,
        className: student.class_name,
        grade: Number(student.grade || 0),
        seatNo: student.seat_no ?? '',
        mainNeed: student.main_need ?? student.main_needs?.[0] ?? '',
        supportLevel: student.support_level ?? '',
        rosterStatus: student.roster_status ?? 'active',
        homeroomTeacher: '',
        specialTeacher: '',
        disabilityCategory: '',
        mainNeeds: student.main_needs ?? [],
        status: student.status,
        parentName: '',
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
        supportServices: [],
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
