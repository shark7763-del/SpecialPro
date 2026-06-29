import type { IEPGoal, Record as CaseRecord, Role, Student } from '../types'
import { getTaipeiDateString } from '../utils/date'
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
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function hasMeetingDraft(record: CaseRecord) {
  const text = `${record.rawText} ${record.aiDraft} ${record.finalText} ${record.followUp}`
  return record.usageTags.includes('IEP檢討') || record.usageTags.includes('交接資料') || /會議|IEP|轉銜|交接/.test(text)
}

function hasTransferNote(record: CaseRecord) {
  const text = `${record.rawText} ${record.aiDraft} ${record.finalText} ${record.followUp}`
  return record.usageTags.includes('交接資料') || /轉銜|交接/.test(text)
}

function upsertTodo(todos: TeacherTodoItem[], todo: TeacherTodoItem) {
  if (todos.some((item) => item.id === todo.id)) return
  todos.push(todo)
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

  visibleStudentsList
    .filter((student) => student.status === 'support' || student.status === 'urgent')
    .forEach((student) => {
      upsertTodo(todos, {
        id: `track-${student.id}`,
        title: '今日要追蹤學生',
        studentName: student.name,
        dueDate: getTaipeiDateString(),
        priority: student.status === 'urgent' ? '高' : '中',
        status: '未處理',
        actionLabel: '前往學生',
        targetTab: '學生',
      })
    })

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

  visibleRecordsList
    .filter((record) => hasMeetingDraft(record) && record.status !== 'confirmed')
    .forEach((record) => {
      const student = students.find((item) => item.id === record.studentId)
      if (!student) return
      upsertTodo(todos, {
        id: `meeting-${record.id}`,
        title: '會議紀錄未定稿',
        studentName: student.name,
        dueDate: formatDue(1),
        priority: '高',
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
        upsertTodo(todos, {
          id: `assessment-${student.id}`,
          title: '評量調整未通知',
          studentName: student.name,
          dueDate: formatDue(5),
          priority: '中',
          status: '未處理',
          actionLabel: '前往評量調整',
          targetTab: 'IEP',
        })
      }
      if (student.supportServices.some((service) => service.status === '待追蹤')) {
        upsertTodo(todos, {
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
      const parentMessageDraft = visibleRecordsList.find((record) => record.studentId === student.id && record.type === '親師溝通' && record.status !== 'confirmed')
      if (parentMessageDraft) {
        upsertTodo(todos, {
          id: `parent-${student.id}`,
          title: '家長訊息待回覆',
          studentName: student.name,
          dueDate: formatDue(1),
          priority: '中',
          status: '未處理',
          actionLabel: '前往紀錄',
          targetTab: '紀錄',
        })
      }
      const homeroomFeedbackDraft = visibleRecordsList.find((record) => record.studentId === student.id && record.type === '普通班回饋' && record.status !== 'confirmed')
      if (homeroomFeedbackDraft) {
        upsertTodo(todos, {
          id: `homeroom-${student.id}`,
          title: '普通班導師回饋待處理',
          studentName: student.name,
          dueDate: formatDue(1),
          priority: '中',
          status: '未處理',
          actionLabel: '前往紀錄',
          targetTab: '紀錄',
        })
      }
      const transferDraft = visibleRecordsList.find((record) => record.studentId === student.id && hasTransferNote(record))
      if (!transferDraft && (student.supportServices.length > 0 || student.mainNeeds.length > 0)) {
        upsertTodo(todos, {
          id: `transfer-${student.id}`,
          title: '轉銜資料缺漏',
          studentName: student.name,
          dueDate: formatDue(10),
          priority: student.status === 'urgent' ? '高' : '低',
          status: '未處理',
          actionLabel: '前往報表',
          targetTab: '報表',
        })
      }
    })

  return todos
    .sort((a, b) => {
      const priorityOrder: Record<TeacherTodoItem['priority'], number> = { 高: 0, 中: 1, 低: 2 }
      return priorityOrder[a.priority] - priorityOrder[b.priority] || a.dueDate.localeCompare(b.dueDate)
    })
    .slice(0, 16)
}
