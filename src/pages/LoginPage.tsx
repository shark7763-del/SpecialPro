import { useState } from 'react'
import { sendMagicLink, signInWithPassword } from '../services/authService'
import { PrivacyNotice } from '../components/PrivacyNotice'

export function LoginPage({ setupError }: { setupError?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const login = async () => {
    setError('')
    setMessage('')
    try {
      await signInWithPassword(email, password)
      setMessage('登入成功，正在載入資料。')
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : '登入失敗。')
    }
  }

  const magic = async () => {
    setError('')
    setMessage('')
    try {
      await sendMagicLink(email)
      setMessage('已寄出 magic link，請到信箱完成登入。')
    } catch (magicError) {
      setError(magicError instanceof Error ? magicError.message : '寄送登入信失敗。')
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-[#f6f7f4] px-4 py-8 text-slate-900">
      <section className="rounded-3xl bg-white p-6 shadow-sm">
        <p className="text-sm font-black text-teal-700">SpecialPro</p>
        <h1 className="mt-2 text-2xl font-black">校園安全測試版登入</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">此版本僅限授權人員使用。未登入者不可讀寫學生資料。</p>
        {setupError && <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900">{setupError}</p>}
        <div className="mt-5 space-y-3">
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="Email" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" />
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="密碼" className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3" />
          <button onClick={login} className="w-full rounded-2xl bg-teal-600 px-4 py-4 font-black text-white">Email / 密碼登入</button>
          <button onClick={magic} className="w-full rounded-2xl bg-slate-100 px-4 py-4 font-black text-slate-800">寄送 Magic Link</button>
        </div>
        {message && <p className="mt-3 rounded-xl bg-teal-50 p-3 text-sm font-bold text-teal-800">{message}</p>}
        {error && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">{error}</p>}
      </section>
      <div className="mt-4">
        <PrivacyNotice />
      </div>
    </main>
  )
}
