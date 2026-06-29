import { useEffect, useMemo, useState } from 'react'
import type { Role } from '../types'
import { canManageRoster, roleCodeToDisplay } from '../services/permissionService'
import { downloadText } from '../services/exportService'
import { createAuditLog, createProfileRow, createStudentRow, loadRosterData, setProfileActive, updateStudentRow, upsertGuardianAccess, upsertTeacherAccess } from '../services/rosterService'
import type { RosterProfile, Student, StudentGuardianRow, StudentTeacherAccessRow } from '../types'

type RosterTab = '學生名單' | '教職員 / 家長帳號' | '學生授權綁定' | 'CSV 批次匯入'

interface Props {
  role: Role
  actorId: string
  schoolId: string
  onRefresh?: () => Promise<void> | void
}

interface CsvPreviewRow {
  raw: Record<string, string>
  errors: string[]
  student?: {
    displayCode: string
    grade: string
    className: string
    seatNo: string
    mainNeed: string
    supportLevel: string
  }
  specialTeacher?: RosterProfile | null
  homeroomTeacher?: RosterProfile | null
  subjectTeachers: RosterProfile[]
  parents: RosterProfile[]
}

const roleOptions: Array<{ label: string; value: RosterProfile['role'] }> = [
  { label: '系統管理員', value: 'admin' },
  { label: '特教組長', value: 'special_chair' },
  { label: '特教導師', value: 'special_teacher' },
  { label: '普通班導師', value: 'homeroom_teacher' },
  { label: '科任老師', value: 'subject_teacher' },
  { label: '家長', value: 'parent' },
]

const bindingOptions: Array<{ label: string; value: StudentTeacherAccessRow['accessType'] | 'parent' }> = [
  { label: '特教導師', value: 'special' },
  { label: '普通班導師', value: 'homeroom' },
  { label: '科任老師', value: 'subject' },
  { label: '家長', value: 'parent' },
]

function parseCsvText(text: string) {
  return text
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')))
}

function splitEmails(value: string) {
  return value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function badgeClass(active: boolean) {
  return active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
}

export function RosterManagementPage({ role, actorId, schoolId, onRefresh }: Props) {
  const [tab, setTab] = useState<RosterTab>('學生名單')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [profiles, setProfiles] = useState<RosterProfile[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [teacherAccess, setTeacherAccess] = useState<StudentTeacherAccessRow[]>([])
  const [guardians, setGuardians] = useState<StudentGuardianRow[]>([])
  const [auditLogs, setAuditLogs] = useState<{ action: string; createdAt: string }[]>([])

  const [studentForm, setStudentForm] = useState({
    id: '',
    displayCode: '',
    grade: '',
    className: '',
    seatNo: '',
    mainNeed: '學習支持',
    supportLevel: '一般支持',
    rosterStatus: 'active' as Student['rosterStatus'],
  })

  const [profileForm, setProfileForm] = useState({
    displayName: '',
    email: '',
    role: 'special_teacher' as RosterProfile['role'],
    className: '',
    subjectName: '',
    isActive: true,
  })

  const [bindingForm, setBindingForm] = useState({
    studentId: '',
    profileId: '',
    bindingType: 'special' as StudentTeacherAccessRow['accessType'] | 'parent',
    relationship: '家長',
    isActive: true,
  })

  const [csvInput, setCsvInput] = useState('')
  const [csvPreview, setCsvPreview] = useState<CsvPreviewRow[]>([])
  const [csvError, setCsvError] = useState('')
  const [gradeFilter, setGradeFilter] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [specialFilter, setSpecialFilter] = useState<'all' | 'missing'>('all')
  const [homeroomFilter, setHomeroomFilter] = useState<'all' | 'missing'>('all')
  const [guardianFilter, setGuardianFilter] = useState<'all' | 'missing'>('all')

  const reload = async () => {
    setLoading(true)
    try {
      const data = await loadRosterData()
      setProfiles(data.profiles)
      setStudents(data.students)
      setTeacherAccess(data.teacherAccess)
      setGuardians(data.guardians)
      setAuditLogs(data.auditLogs.map((item) => ({ action: item.action, createdAt: item.createdAt })))
      setError('')
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '讀取名單失敗。')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!canManageRoster(role)) return
    void reload()
  }, [role])

  const studentStats = useMemo(() => {
    const specialMissing = students.filter((student) => !teacherAccess.some((access) => access.studentId === student.id && access.accessType === 'special' && access.isActive)).length
    const homeroomMissing = students.filter((student) => !teacherAccess.some((access) => access.studentId === student.id && access.accessType === 'homeroom' && access.isActive)).length
    const guardianMissing = students.filter((student) => !guardians.some((guardian) => guardian.studentId === student.id && guardian.isActive)).length
    const disabledProfiles = profiles.filter((profile) => !profile.isActive).length
    const recentStudentCount = students.filter((student) => new Date(student.createdAt).getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000).length
    const recentBindingCount = auditLogs.filter((log) => /bind_student_/.test(log.action) && new Date(log.createdAt).getTime() >= Date.now() - 7 * 24 * 60 * 60 * 1000).length
    return { specialMissing, homeroomMissing, guardianMissing, disabledProfiles, recentStudentCount, recentBindingCount }
  }, [students, teacherAccess, guardians, profiles, auditLogs])

  const studentIndex = new Map(students.map((student) => [student.id, student]))

  const teacherProfiles = profiles.filter((profile) => ['special_teacher', 'special_chair', 'homeroom_teacher', 'subject_teacher', 'admin'].includes(profile.role))
  const parentProfiles = profiles.filter((profile) => profile.role === 'parent')

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const special = teacherAccess.some((item) => item.studentId === student.id && item.accessType === 'special' && item.isActive)
      const homeroom = teacherAccess.some((item) => item.studentId === student.id && item.accessType === 'homeroom' && item.isActive)
      const parent = guardians.some((item) => item.studentId === student.id && item.isActive)
      if (gradeFilter && String(student.grade) !== gradeFilter) return false
      if (classFilter && !student.className.includes(classFilter)) return false
      if (activeFilter !== 'all' && (student.rosterStatus || 'active') !== activeFilter) return false
      if (specialFilter === 'missing' && special) return false
      if (homeroomFilter === 'missing' && homeroom) return false
      if (guardianFilter === 'missing' && parent) return false
      return true
    })
  }, [students, teacherAccess, guardians, gradeFilter, classFilter, activeFilter, specialFilter, homeroomFilter, guardianFilter])

  const saveStudent = async () => {
    try {
      if (!studentForm.displayCode || !studentForm.className || !schoolId) throw new Error('請填寫學生必要欄位。')
      if (studentForm.id) {
        await updateStudentRow({
          id: studentForm.id,
          schoolId,
          actorId,
          patch: {
            displayCode: studentForm.displayCode,
            grade: studentForm.grade,
            className: studentForm.className,
            seatNo: studentForm.seatNo,
            mainNeed: studentForm.mainNeed,
            supportLevel: studentForm.supportLevel,
            rosterStatus: studentForm.rosterStatus,
          },
        })
      } else {
        await createStudentRow({
          schoolId,
          actorId,
          displayCode: studentForm.displayCode,
          grade: studentForm.grade,
          className: studentForm.className,
          seatNo: studentForm.seatNo,
          mainNeed: studentForm.mainNeed,
          supportLevel: studentForm.supportLevel,
          rosterStatus: studentForm.rosterStatus,
          mainNeeds: [studentForm.mainNeed],
          iepFocus: [],
          supportStrategies: [],
          regularClassTips: [],
        })
      }
      setMessage(studentForm.id ? '學生資料已更新。' : '學生已建立。')
      setStudentForm({ id: '', displayCode: '', grade: '', className: '', seatNo: '', mainNeed: '學習支持', supportLevel: '一般支持', rosterStatus: 'active' })
      await reload()
      await onRefresh?.()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '儲存學生失敗。')
    }
  }

  const saveProfile = async () => {
    try {
      if (!profileForm.displayName || !profileForm.email) throw new Error('請填寫帳號必要欄位。')
      await createProfileRow({
        schoolId,
        actorId,
        email: profileForm.email,
        role: profileForm.role,
        displayName: profileForm.displayName,
        className: profileForm.className || null,
        subjectName: profileForm.subjectName || null,
        isActive: profileForm.isActive,
      })
      setMessage('profile 已建立。')
      setProfileForm({ displayName: '', email: '', role: 'special_teacher', className: '', subjectName: '', isActive: true })
      await reload()
      await onRefresh?.()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '儲存 profile 失敗。')
    }
  }

  const saveBinding = async () => {
    try {
      const student = studentIndex.get(bindingForm.studentId)
      const profile = profiles.find((item) => item.id === bindingForm.profileId)
      if (!student || !profile) throw new Error('請先選擇學生與人員。')
      if (bindingForm.bindingType === 'parent') {
        if (profile.role !== 'parent') throw new Error('家長綁定請選家長帳號。')
        await upsertGuardianAccess({
          schoolId,
          actorId,
          studentId: student.id,
          guardianId: profile.id,
          relationship: bindingForm.relationship || '家長',
          isActive: bindingForm.isActive,
        })
      } else {
        await upsertTeacherAccess({
          schoolId,
          actorId,
          studentId: student.id,
          teacherId: profile.id,
          accessType: bindingForm.bindingType,
          isActive: bindingForm.isActive,
        })
      }
      setMessage(bindingForm.isActive ? '已建立綁定。' : '已停用綁定。')
      await reload()
      await onRefresh?.()
    } catch (bindError) {
      setError(bindError instanceof Error ? bindError.message : '綁定失敗。')
    }
  }

  const deactivateStudent = async (student: Student) => {
    if (!window.confirm(`要停用 ${student.name} 嗎？`)) return
    await updateStudentRow({
      id: student.id,
      schoolId,
      actorId,
      patch: { rosterStatus: 'inactive' },
    })
    setMessage('學生已停用。')
    await reload()
    await onRefresh?.()
  }

  const toggleProfileActive = async (profile: RosterProfile) => {
    await setProfileActive({ id: profile.id, schoolId, actorId, isActive: !profile.isActive })
    setMessage(profile.isActive ? '已停用帳號。' : '已啟用帳號。')
    await reload()
    await onRefresh?.()
  }

  const buildPreview = () => {
    try {
      const lines = parseCsvText(csvInput)
      if (!lines.length) throw new Error('CSV 內容空白。')
      const [headerRow, ...dataRows] = lines
      const expectedHeaders = ['student_display_code', 'grade', 'class_name', 'seat_no', 'main_need', 'support_level', 'special_teacher_email', 'homeroom_teacher_email', 'subject_teacher_emails', 'parent_emails']
      const headers = headerRow.map((item) => item.trim())
      if (expectedHeaders.some((item, index) => headers[index] !== item)) {
        throw new Error('CSV 欄位順序不正確，請依範例欄位匯入。')
      }
      const preview = dataRows.map((row) => {
        const record = Object.fromEntries(expectedHeaders.map((key, index) => [key, row[index] || '']))
        const errors: string[] = []
        const displayCode = record.student_display_code.trim()
        const grade = record.grade.trim()
        const className = record.class_name.trim()
        if (!displayCode || !grade || !className) errors.push('學生 display_code、年級、班級為必填。')
        if (students.some((student) => student.name === displayCode && student.className === className)) errors.push('學生已存在。')
        const specialTeacher = profiles.find((profile) => profile.email?.toLowerCase() === record.special_teacher_email.toLowerCase()) || null
        const homeroomTeacher = profiles.find((profile) => profile.email?.toLowerCase() === record.homeroom_teacher_email.toLowerCase()) || null
        if (record.special_teacher_email && !isEmail(record.special_teacher_email)) errors.push(`特教導師 email 格式錯誤：${record.special_teacher_email}`)
        if (record.homeroom_teacher_email && !isEmail(record.homeroom_teacher_email)) errors.push(`普通班導師 email 格式錯誤：${record.homeroom_teacher_email}`)
        if (record.special_teacher_email && !specialTeacher) errors.push(`找不到特教導師帳號：${record.special_teacher_email}`)
        if (record.homeroom_teacher_email && !homeroomTeacher) errors.push(`找不到普通班導師帳號：${record.homeroom_teacher_email}`)
        const subjectEmails = splitEmails(record.subject_teacher_emails)
        const parentEmails = splitEmails(record.parent_emails)
        subjectEmails.forEach((email) => { if (!isEmail(email)) errors.push(`科任老師 email 格式錯誤：${email}`) })
        parentEmails.forEach((email) => { if (!isEmail(email)) errors.push(`家長 email 格式錯誤：${email}`) })
        const subjectTeachers = subjectEmails.map((email) => profiles.find((profile) => profile.email?.toLowerCase() === email.toLowerCase())).filter(Boolean) as RosterProfile[]
        const parents = parentEmails.map((email) => profiles.find((profile) => profile.email?.toLowerCase() === email.toLowerCase())).filter(Boolean) as RosterProfile[]
        subjectEmails.forEach((email, index) => { if (!subjectTeachers[index]) errors.push(`找不到科任老師帳號：${email}`) })
        parentEmails.forEach((email, index) => { if (!parents[index]) errors.push(`找不到家長帳號：${email}`) })
        return {
          raw: record,
          errors,
          student: { displayCode, grade, className, seatNo: record.seat_no.trim(), mainNeed: record.main_need.trim(), supportLevel: record.support_level.trim() },
          specialTeacher,
          homeroomTeacher,
          subjectTeachers,
          parents,
        } satisfies CsvPreviewRow
      })
      setCsvPreview(preview)
      setCsvError('')
    } catch (previewError) {
      setCsvError(previewError instanceof Error ? previewError.message : '預覽失敗。')
      setCsvPreview([])
    }
  }

  const importCsv = async () => {
    try {
      if (!csvPreview.length) throw new Error('請先完成 CSV 預覽。')
      const hasErrors = csvPreview.some((row) => row.errors.length > 0)
      if (hasErrors) throw new Error('預覽中有錯誤，請修正後再匯入。')
      let successCount = 0
      let teacherBindCount = 0
      let guardianBindCount = 0
      for (const row of csvPreview) {
        if (!row.student) continue
        const student = await createStudentRow({
          schoolId,
          actorId,
          displayCode: row.student.displayCode,
          grade: row.student.grade,
          className: row.student.className,
          seatNo: row.student.seatNo,
          mainNeed: row.student.mainNeed,
          supportLevel: row.student.supportLevel,
          rosterStatus: 'active',
          homeroomTeacherId: row.homeroomTeacher?.id || null,
          specialTeacherId: row.specialTeacher?.id || null,
          mainNeeds: [row.student.mainNeed],
          iepFocus: [],
          supportStrategies: [],
          regularClassTips: [],
        })
        if (row.specialTeacher) {
          await upsertTeacherAccess({ schoolId, actorId, studentId: student.id, teacherId: row.specialTeacher.id, accessType: 'special', isActive: true })
          teacherBindCount += 1
        }
        if (row.homeroomTeacher) {
          await upsertTeacherAccess({ schoolId, actorId, studentId: student.id, teacherId: row.homeroomTeacher.id, accessType: 'homeroom', isActive: true })
          teacherBindCount += 1
        }
        for (const profile of row.subjectTeachers) {
          await upsertTeacherAccess({ schoolId, actorId, studentId: student.id, teacherId: profile.id, accessType: 'subject', isActive: true })
          teacherBindCount += 1
        }
        for (const profile of row.parents) {
          await upsertGuardianAccess({ schoolId, actorId, studentId: student.id, guardianId: profile.id, relationship: '家長', isActive: true })
          guardianBindCount += 1
        }
        successCount += 1
      }
      await createAuditLog({
        actorId,
        schoolId,
        action: 'bulk_import_roster',
        targetTable: 'students',
        targetId: 'bulk_import',
        metadata: { imported: successCount },
      })
      setMessage(`已匯入 ${successCount} 位學生，${teacherBindCount} 筆老師綁定，${guardianBindCount} 筆家長綁定。`)
      setCsvInput('')
      setCsvPreview([])
      await reload()
      await onRefresh?.()
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : '匯入失敗。')
    }
  }

  if (!canManageRoster(role)) {
    return <main className="px-4"><p className="rounded-2xl bg-white p-5 text-sm font-semibold text-slate-700 shadow-sm">此頁僅限系統管理員與特教組長使用。</p></main>
  }

  if (loading) {
    return <main className="px-4"><p className="rounded-2xl bg-white p-5 text-sm font-semibold text-slate-700 shadow-sm">名單資料載入中...</p></main>
  }

  return (
    <main className="space-y-5 px-4">
      <section className="rounded-3xl bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-teal-700">後台名單管理</p>
        <h2 className="mt-1 text-2xl font-black text-slate-900">建立學生、帳號與授權綁定</h2>
        <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-900">校園測試版請避免輸入完整姓名、身分證字號、完整醫療診斷、完整病歷或非必要敏感資料。建議使用王○安這類 display_code。</p>
      </section>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">未綁特教導師學生數</p><p className="text-2xl font-black text-rose-700">{studentStats.specialMissing}</p></div>
        <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">未綁普通班導師學生數</p><p className="text-2xl font-black text-rose-700">{studentStats.homeroomMissing}</p></div>
        <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">未綁家長學生數</p><p className="text-2xl font-black text-rose-700">{studentStats.guardianMissing}</p></div>
        <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">停用帳號數</p><p className="text-2xl font-black text-slate-900">{studentStats.disabledProfiles}</p></div>
        <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">最近 7 天新增學生數</p><p className="text-2xl font-black text-teal-700">{studentStats.recentStudentCount}</p></div>
        <div className="rounded-2xl bg-white p-4 shadow-sm"><p className="text-sm text-slate-500">最近 7 天新增綁定數</p><p className="text-2xl font-black text-teal-700">{studentStats.recentBindingCount}</p></div>
      </div>
      <div className="rounded-2xl bg-white p-3 shadow-sm">
        <div className="grid grid-cols-4 gap-2">
          {['學生名單', '教職員 / 家長帳號', '學生授權綁定', 'CSV 批次匯入'].map((item) => (
            <button key={item} onClick={() => setTab(item as RosterTab)} className={`rounded-xl px-3 py-3 text-sm font-bold ${tab === item ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{item}</button>
          ))}
        </div>
      </div>

      {error && <p className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-800">{error}</p>}
      {message && <p className="rounded-2xl bg-teal-50 p-4 text-sm font-bold text-teal-800">{message}</p>}

      {tab === '學生名單' && (
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3 rounded-3xl bg-white p-4 shadow-sm">
            <input value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)} placeholder="年級篩選" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" />
            <input value={classFilter} onChange={(event) => setClassFilter(event.target.value)} placeholder="班級篩選" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" />
            <select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value as 'all' | 'active' | 'inactive')} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><option value="all">全部狀態</option><option value="active">active</option><option value="inactive">inactive</option></select>
            <select value={specialFilter} onChange={(event) => setSpecialFilter(event.target.value as 'all' | 'missing')} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><option value="all">全部特教導師</option><option value="missing">未綁特教導師</option></select>
            <select value={homeroomFilter} onChange={(event) => setHomeroomFilter(event.target.value as 'all' | 'missing')} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><option value="all">全部普通班導師</option><option value="missing">未綁普通班導師</option></select>
            <select value={guardianFilter} onChange={(event) => setGuardianFilter(event.target.value as 'all' | 'missing')} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"><option value="all">全部家長</option><option value="missing">未綁家長</option></select>
          </div>
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">{studentForm.id ? '編輯學生' : '新增學生'}</h3>
            <div className="mt-4 grid gap-3">
              <input value={studentForm.displayCode} onChange={(event) => setStudentForm((prev) => ({ ...prev, displayCode: event.target.value }))} placeholder="display_code，例如：王○安" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" />
              <div className="grid grid-cols-2 gap-3">
                <input value={studentForm.grade} onChange={(event) => setStudentForm((prev) => ({ ...prev, grade: event.target.value }))} placeholder="年級，例如：七年級" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" />
                <input value={studentForm.className} onChange={(event) => setStudentForm((prev) => ({ ...prev, className: event.target.value }))} placeholder="班級，例如：701" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <input value={studentForm.seatNo} onChange={(event) => setStudentForm((prev) => ({ ...prev, seatNo: event.target.value }))} placeholder="座號" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" />
                <select value={studentForm.mainNeed} onChange={(event) => setStudentForm((prev) => ({ ...prev, mainNeed: event.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  {['學習支持', '情緒支持', '社交支持', '生活適應'].map((item) => <option key={item}>{item}</option>)}
                </select>
                <select value={studentForm.supportLevel} onChange={(event) => setStudentForm((prev) => ({ ...prev, supportLevel: event.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  {['一般支持', '中度支持', '高度支持'].map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
              <select value={studentForm.rosterStatus} onChange={(event) => setStudentForm((prev) => ({ ...prev, rosterStatus: event.target.value as Student['rosterStatus'] }))} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                {['active', 'inactive', 'graduated', 'transferred'].map((item) => <option key={item}>{item}</option>)}
              </select>
              <button onClick={saveStudent} className="rounded-2xl bg-teal-600 px-5 py-4 font-black text-white">{studentForm.id ? '儲存變更' : '建立學生'}</button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-[1100px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  {['display_code', '年級', '班級', '主要需求', '特教導師是否已綁定', '普通班導師是否已綁定', '科任老師數量', '家長數量', '狀態', '操作'].map((head) => <th key={head} className="px-3 py-3">{head}</th>)}
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const special = teacherAccess.some((item) => item.studentId === student.id && item.accessType === 'special' && item.isActive)
                  const homeroom = teacherAccess.some((item) => item.studentId === student.id && item.accessType === 'homeroom' && item.isActive)
                  const subjectCount = teacherAccess.filter((item) => item.studentId === student.id && item.accessType === 'subject' && item.isActive).length
                  const parentCount = guardians.filter((item) => item.studentId === student.id && item.isActive).length
                  return (
                    <tr key={student.id} className="border-t border-slate-100">
                      <td className="px-3 py-3 font-bold">{student.name}</td>
                      <td className="px-3 py-3">{student.grade}</td>
                      <td className="px-3 py-3">{student.className}</td>
                      <td className="px-3 py-3">{student.mainNeed || student.mainNeeds[0] || '—'}</td>
                      <td className="px-3 py-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${badgeClass(special)}`}>{special ? '已綁定' : '未綁定'}</span></td>
                      <td className="px-3 py-3"><span className={`rounded-full px-3 py-1 text-xs font-bold ${badgeClass(homeroom)}`}>{homeroom ? '已綁定' : '未綁定'}</span></td>
                      <td className="px-3 py-3">{subjectCount}</td>
                      <td className="px-3 py-3">{parentCount}</td>
                      <td className="px-3 py-3">{student.rosterStatus || 'active'}</td>
                      <td className="px-3 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => { setStudentForm({ id: student.id, displayCode: student.name, grade: String(student.grade || ''), className: student.className, seatNo: student.seatNo || '', mainNeed: student.mainNeed || '', supportLevel: student.supportLevel || '', rosterStatus: student.rosterStatus || 'active' }); setTab('學生名單') }} className="rounded-xl bg-slate-100 px-3 py-2 font-bold text-slate-700">編輯</button>
                          <button onClick={() => { setBindingForm((prev) => ({ ...prev, studentId: student.id })); setTab('學生授權綁定') }} className="rounded-xl bg-teal-50 px-3 py-2 font-bold text-teal-700">綁定</button>
                          <button onClick={() => void deactivateStudent(student)} className="rounded-xl bg-rose-50 px-3 py-2 font-bold text-rose-700">停用</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === '教職員 / 家長帳號' && (
        <section className="space-y-4">
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">新增或更新 profile</h3>
            <p className="mt-2 rounded-2xl bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-900">手動模式：先到 Supabase Authentication 建立帳號，再回來建立 profile。若 email 找不到對應 Auth 使用者，系統會提示錯誤。未來可再接 Edge Function invitation。</p>
            <div className="mt-4 grid gap-3">
              <input value={profileForm.displayName} onChange={(event) => setProfileForm((prev) => ({ ...prev, displayName: event.target.value }))} placeholder="display_name" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" />
              <input value={profileForm.email} onChange={(event) => setProfileForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="email" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" />
              <div className="grid grid-cols-2 gap-3">
                <select value={profileForm.role} onChange={(event) => setProfileForm((prev) => ({ ...prev, role: event.target.value as RosterProfile['role'] }))} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  {roleOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-700"><input type="checkbox" checked={profileForm.isActive} onChange={(event) => setProfileForm((prev) => ({ ...prev, isActive: event.target.checked }))} />啟用帳號</label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input value={profileForm.className} onChange={(event) => setProfileForm((prev) => ({ ...prev, className: event.target.value }))} placeholder="class_name" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" />
                <input value={profileForm.subjectName} onChange={(event) => setProfileForm((prev) => ({ ...prev, subjectName: event.target.value }))} placeholder="subject_name" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" />
              </div>
              <button onClick={saveProfile} className="rounded-2xl bg-teal-600 px-5 py-4 font-black text-white">建立 / 更新 profile</button>
            </div>
          </div>
          <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600"><tr>{['姓名', 'Email', '角色', '班級', '專長科目', '狀態', '操作'].map((head) => <th key={head} className="px-3 py-3">{head}</th>)}</tr></thead>
              <tbody>{profiles.map((profile) => <tr key={profile.id} className="border-t border-slate-100"><td className="px-3 py-3 font-bold">{profile.displayName}</td><td className="px-3 py-3">{profile.email || '—'}</td><td className="px-3 py-3">{roleCodeToDisplay(profile.role)}</td><td className="px-3 py-3">{profile.className || '—'}</td><td className="px-3 py-3">{profile.subjectName || '—'}</td><td className="px-3 py-3">{profile.isActive ? '啟用' : '停用'}</td><td className="px-3 py-3"><button onClick={() => void toggleProfileActive(profile)} className="rounded-xl bg-slate-100 px-3 py-2 font-bold text-slate-700">{profile.isActive ? '停用' : '啟用'}</button></td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}

      {tab === '學生授權綁定' && (
        <section className="space-y-4">
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">綁定學生與人員</h3>
            <div className="mt-4 grid gap-3">
              <select value={bindingForm.studentId} onChange={(event) => setBindingForm((prev) => ({ ...prev, studentId: event.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <option value="">選擇學生</option>
                {students.map((student) => <option key={student.id} value={student.id}>{student.name}｜{student.className}</option>)}
              </select>
              <select value={bindingForm.bindingType} onChange={(event) => setBindingForm((prev) => ({ ...prev, bindingType: event.target.value as StudentTeacherAccessRow['accessType'] | 'parent' }))} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                {bindingOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <select value={bindingForm.profileId} onChange={(event) => setBindingForm((prev) => ({ ...prev, profileId: event.target.value }))} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <option value="">選擇人員</option>
                {(bindingForm.bindingType === 'parent' ? parentProfiles : teacherProfiles).map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}｜{profile.email || '無 email'}</option>)}
              </select>
              <input value={bindingForm.relationship} onChange={(event) => setBindingForm((prev) => ({ ...prev, relationship: event.target.value }))} placeholder="relationship（家長時使用）" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" />
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-semibold text-slate-700"><input type="checkbox" checked={bindingForm.isActive} onChange={(event) => setBindingForm((prev) => ({ ...prev, isActive: event.target.checked }))} />啟用綁定</label>
              <button onClick={saveBinding} className="rounded-2xl bg-teal-600 px-5 py-4 font-black text-white">儲存綁定</button>
            </div>
          </div>
          <div className="grid gap-4">
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <h4 className="font-black text-slate-900">特教 / 普通班 / 科任 綁定</h4>
              <div className="mt-3 space-y-2">{teacherAccess.map((item) => {
                const student = studentIndex.get(item.studentId)
                const profile = profiles.find((profile) => profile.id === item.teacherId)
                return <div key={`${item.studentId}-${item.teacherId}`} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm"><div><b>{student?.name}</b>｜{profile?.displayName || item.teacherId}｜{item.accessType}</div><button onClick={() => void upsertTeacherAccess({ schoolId, actorId, studentId: item.studentId, teacherId: item.teacherId, accessType: item.accessType, isActive: false }).then(() => reload())} className="rounded-xl bg-rose-50 px-3 py-2 font-bold text-rose-700">解除綁定</button></div>
              })}</div>
            </div>
            <div className="rounded-3xl bg-white p-5 shadow-sm">
              <h4 className="font-black text-slate-900">家長綁定</h4>
              <div className="mt-3 space-y-2">{guardians.map((item) => {
                const student = studentIndex.get(item.studentId)
                const profile = profiles.find((profile) => profile.id === item.guardianId)
                return <div key={`${item.studentId}-${item.guardianId}`} className="flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm"><div><b>{student?.name}</b>｜{profile?.displayName || item.guardianId}｜{item.relationship || '家長'}</div><button onClick={() => void upsertGuardianAccess({ schoolId, actorId, studentId: item.studentId, guardianId: item.guardianId, relationship: item.relationship || '家長', isActive: false }).then(() => reload())} className="rounded-xl bg-rose-50 px-3 py-2 font-bold text-rose-700">解除綁定</button></div>
              })}</div>
            </div>
          </div>
        </section>
      )}

      {tab === 'CSV 批次匯入' && (
        <section className="space-y-4">
          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <h3 className="text-lg font-black text-slate-900">CSV 匯入</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">欄位：student_display_code, grade, class_name, seat_no, main_need, support_level, special_teacher_email, homeroom_teacher_email, subject_teacher_emails, parent_emails</p>
            <button onClick={() => downloadText('specialpro_roster_template.csv', ['student_display_code,grade,class_name,seat_no,main_need,support_level,special_teacher_email,homeroom_teacher_email,subject_teacher_emails,parent_emails', '王○安,七年級,701,5,學習支持,一般支持,special@example.com,homeroom@example.com,subject1@example.com;subject2@example.com,parent@example.com'].join('\n'), 'text/csv;charset=utf-8')} className="mt-3 rounded-xl bg-slate-100 px-4 py-3 font-bold text-slate-700">下載範本</button>
            <textarea value={csvInput} onChange={(event) => setCsvInput(event.target.value)} rows={8} className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6" placeholder="貼上 CSV 內容" />
            <div className="mt-3 flex gap-2">
              <button onClick={buildPreview} className="rounded-xl bg-slate-900 px-4 py-3 font-bold text-white">解析預覽</button>
              <label className="rounded-xl bg-slate-100 px-4 py-3 font-bold text-slate-700">
                上傳 CSV
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={async (event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  setCsvInput(await file.text())
                }} />
              </label>
            </div>
            {csvError && <p className="mt-3 rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{csvError}</p>}
          </div>
          {csvPreview.length > 0 && (
            <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-[1200px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>{['學生', '年級', '班級', '座號', '主要需求', '支持層級', '錯誤'].map((head) => <th key={head} className="px-3 py-3">{head}</th>)}</tr>
                </thead>
                <tbody>
                  {csvPreview.map((row, index) => (
                    <tr key={index} className="border-t border-slate-100">
                      <td className="px-3 py-3 font-bold">{row.student?.displayCode || row.raw.student_display_code}</td>
                      <td className="px-3 py-3">{row.student?.grade || row.raw.grade}</td>
                      <td className="px-3 py-3">{row.student?.className || row.raw.class_name}</td>
                      <td className="px-3 py-3">{row.student?.seatNo || row.raw.seat_no}</td>
                      <td className="px-3 py-3">{row.student?.mainNeed || row.raw.main_need}</td>
                      <td className="px-3 py-3">{row.student?.supportLevel || row.raw.support_level}</td>
                      <td className="px-3 py-3 text-rose-700">{row.errors.join('；') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-4">
                <button onClick={importCsv} className="rounded-2xl bg-teal-600 px-5 py-4 font-black text-white">確認匯入</button>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  )
}
