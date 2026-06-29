import type { IEPGoal, Record as CaseRecord, Role, Student } from '../types'
import { visibleRecords, visibleStudents } from './permissionService'

export interface TeacherTodoItem {
  id: string
  title: string
  studentName: string
  dueDate: string
  priority: '高' | '中' | '低'
  status: '未處理' | '處理中' | '已完成' | '逾期'
  actionLabel: string
  targetTab: '首頁' | '學生' | '紀錄' | 'IEP' | '報表' | '名單管理' | '妥善率檢查'
}

function formatDue(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function getTeacherTodoList(
  userId: string,
  role: Role,
  students: Student[],
  records: CaseRecord[],
  iepGoals: IEPGoal[],
) {
  if (role === '家長') return []

  const visibleStudentsList = visibleStudents(students, role, userId)
  const visibleStudentIds = new Set(visibleStudentsList.map((student) => student.id))
  const visibleRecordsList = visibleRecords(records, students, role, userId)
  const todos: TeacherTodoItem[] = []

  const draftRecords = visibleRecordsList.filter((record) => record.status === 'ai_draft' || record.status === 'teacher_draft')
  draftRecords.forEach((record) => {
    const student = students.find((item) => item.id === record.studentId)
    if (!student) return
    todos.push({
      id: `record-${record.id}`,
      title: record.status === 'teacher_draft' ? '草稿待定稿' : 'AI 草稿待確認',
      studentName: student.name,
      dueDate: formatDue(record.status === 'ai_draft' ? 0 : 1),
      priority: record.status === 'ai_draft' ? '高' : '中',
      status: '未處理',
      actionLabel: '前往紀錄',
      targetTab: '紀錄',
    })
  })

  iepGoals
    .filter((goal) => visibleStudentIds.has(goal.studentId) && !goal.confirmed)
    .forEach((goal) => {
      const student = students.find((item) => item.id === goal.studentId)
      if (!student) return
      todos.push({
        id: `iep-${goal.id}`,
        title: 'IEP 目標待確認',
        studentName: student.name,
        dueDate: formatDue(3),
        priority: '高',
        status: '未處理',
        actionLabel: '前往 IEP',
        targetTab: 'IEP',
      })
    })

  students
    .filter((student) => visibleStudentIds.has(student.id))
    .forEach((student) => {
      if (!student.assessmentAdjustments.notifiedHomeroom || !student.assessmentAdjustments.notifiedSubjectTeachers || !student.assessmentAdjustments.notifiedAcademicOffice) {
        todos.push({
          id: `assessment-${student.id}`,
          title: '評量調整待確認',
          studentName: student.name,
          dueDate: formatDue(5),
          priority: '中',
          status: '未處理',
          actionLabel: '前往評量調整',
          targetTab: 'IEP',
        })
      }
      if (student.supportServices.some((service) => service.status === '待追蹤')) {
        todos.push({
          id: `service-${student.id}`,
          title: '支持服務待追蹤',
          studentName: student.name,
          dueDate: student.supportServices.find((service) => service.status === '待追蹤')?.nextFollowUpDate || formatDue(7),
          priority: '中',
          status: '處理中',
          actionLabel: '前往學生',
          targetTab: '學生',
        })
      }
    })

  return todos.slice(0, 12)
}
