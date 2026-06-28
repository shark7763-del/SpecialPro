import type { Record, Role, Student } from '../types'
import { isSupabaseConfigured, supabase } from './supabaseClient'

export interface SyncResult {
  ok: boolean
  message: string
  syncedAt?: string
}

function assertClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('尚未設定 Supabase URL / anon key。')
  }
  return supabase
}

export async function pushToSupabase(students: Student[], records: Record[], role: Role): Promise<SyncResult> {
  try {
    const client = assertClient()
    const syncedAt = new Date().toISOString()

    const { error: studentsError } = await client.from('students').upsert(
      students.map((student) => ({
        id: student.id,
        data: student,
        updated_at: syncedAt,
      })),
    )
    if (studentsError) throw studentsError

    const { error: recordsError } = await client.from('records').upsert(
      records.map((record) => ({
        id: record.id,
        student_id: record.studentId,
        data: record,
        updated_at: syncedAt,
      })),
    )
    if (recordsError) throw recordsError

    const { error: adjustmentsError } = await client.from('assessment_adjustments').upsert(
      students.map((student) => ({
        student_id: student.id,
        data: student.assessmentAdjustments,
        updated_at: syncedAt,
      })),
    )
    if (adjustmentsError) throw adjustmentsError

    await client.from('sync_audit_logs').insert({
      user_role: role,
      action: 'push',
      target_type: 'dataset',
      target_id: 'localStorage',
    })

    return { ok: true, message: '已同步到 Supabase 後台。', syncedAt }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : '同步失敗。' }
  }
}

export async function pullFromSupabase(): Promise<{ result: SyncResult; students?: Student[]; records?: Record[] }> {
  try {
    const client = assertClient()
    const [{ data: studentRows, error: studentsError }, { data: recordRows, error: recordsError }] = await Promise.all([
      client.from('students').select('data').order('updated_at', { ascending: false }),
      client.from('records').select('data').order('updated_at', { ascending: false }),
    ])
    if (studentsError) throw studentsError
    if (recordsError) throw recordsError

    return {
      result: {
        ok: true,
        message: `已從 Supabase 下載 ${studentRows?.length ?? 0} 位學生、${recordRows?.length ?? 0} 筆紀錄。`,
        syncedAt: new Date().toISOString(),
      },
      students: (studentRows ?? []).map((row) => row.data as Student),
      records: (recordRows ?? []).map((row) => row.data as Record),
    }
  } catch (error) {
    return { result: { ok: false, message: error instanceof Error ? error.message : '下載失敗。' } }
  }
}
