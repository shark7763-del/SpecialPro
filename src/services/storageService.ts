import { mockRecords, mockStudents } from '../data/mockData'
import type { IEPGoal, Record, Student } from '../types'

const STUDENTS_KEY = 'specialpro_students'
const RECORDS_KEY = 'specialpro_records'
const IEP_KEY = 'specialpro_iep_goals'

function read<T>(key: string, fallback: T): T {
  const value = localStorage.getItem(key)
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function loadStudents() {
  return read<Student[]>(STUDENTS_KEY, mockStudents)
}

export function loadRecords() {
  return read<Record[]>(RECORDS_KEY, mockRecords)
}

export function loadIepGoals() {
  return read<IEPGoal[]>(IEP_KEY, [])
}

export function saveStudents(students: Student[]) {
  write(STUDENTS_KEY, students)
}

export function saveRecords(records: Record[]) {
  write(RECORDS_KEY, records)
}

export function saveIepGoals(goals: IEPGoal[]) {
  write(IEP_KEY, goals)
}

export function resetDemoData() {
  saveStudents(mockStudents)
  saveRecords(mockRecords)
  saveIepGoals([])
}
