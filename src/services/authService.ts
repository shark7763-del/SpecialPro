import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import type { RoleCode } from '../types'

export interface UserProfile {
  id: string
  school_id: string | null
  role: RoleCode
  display_name: string
  class_name: string | null
  subject_name: string | null
  is_active: boolean
}

export async function getSession() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}

export function onAuthStateChange(callback: (session: Session | null) => void) {
  if (!supabase) return () => undefined
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
  return () => data.subscription.unsubscribe()
}

export async function signInWithPassword(email: string, password: string) {
  if (!supabase) throw new Error('Supabase 尚未設定。')
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function sendMagicLink(email: string) {
  if (!supabase) throw new Error('Supabase 尚未設定。')
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href },
  })
  if (error) throw error
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}

export async function getProfile(user: User) {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('get_my_profile')
  if (error) throw error
  const profile = Array.isArray(data) ? data[0] : data
  if (!profile || profile.id !== user.id) return null
  return profile as UserProfile | null
}
