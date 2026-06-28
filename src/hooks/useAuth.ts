import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { getProfile, getSession, onAuthStateChange, type UserProfile } from '../services/authService'
import { isSupabaseConfigured } from '../services/supabaseClient'

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function load(currentSession: Session | null) {
      if (!active) return
      setSession(currentSession)
      setError('')
      if (!currentSession?.user) {
        setProfile(null)
        setLoading(false)
        return
      }
      try {
        const userProfile = await getProfile(currentSession.user)
        if (active) setProfile(userProfile)
      } catch (profileError) {
        if (active) setError(profileError instanceof Error ? profileError.message : '讀取 profile 失敗。')
      } finally {
        if (active) setLoading(false)
      }
    }

    if (!isSupabaseConfigured) {
      setLoading(false)
      return () => {
        active = false
      }
    }

    getSession().then(load).catch((sessionError: unknown) => {
      setError(sessionError instanceof Error ? sessionError.message : '讀取登入狀態失敗。')
      setLoading(false)
    })
    const unsubscribe = onAuthStateChange((nextSession) => {
      setLoading(true)
      void load(nextSession)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return {
    session,
    profile,
    loading,
    error,
    isLoggedIn: Boolean(session?.user && profile?.is_active),
  }
}
