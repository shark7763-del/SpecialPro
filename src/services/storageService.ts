import { mockRecords, mockStudents } from '../data/mockData'
import type { Record, Student } from '../types'

const STUDENTS_KEY = 'specialpro_students'
const RECORDS_KEY = 'specialpro_records'

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

export function saveStudents(students: Student[]) {
  write(STUDENTS_KEY, students)
}

export function saveRecords(records: Record[]) {
  write(RECORDS_KEY, records)
}

export function resetDemoData() {
  saveStudents(mockStudents)
  saveRecords(mockRecords)
}
