import { appMode } from '../config/appMode'

export function SafetyModeBanner({ isLoggedIn, isSupabaseReady }: { isLoggedIn: boolean; isSupabaseReady: boolean }) {
  const isSchoolTest = appMode === 'school_test'
  return (
    <section className={`mx-4 rounded-2xl border p-4 text-sm leading-6 shadow-sm ${isSchoolTest ? 'border-amber-200 bg-amber-50 text-amber-950' : 'border-sky-200 bg-sky-50 text-sky-950'}`}>
      <p className="font-black">{isSchoolTest ? '校園安全測試版' : '展示模式'}</p>
      <p>登入狀態：{isLoggedIn ? '已登入' : '未登入'}｜Supabase：{isSupabaseReady ? '可連線' : '未設定或離線'}</p>
      <p className="mt-1">{isSchoolTest ? '校園安全測試版：請僅輸入測試授權範圍內資料，避免輸入完整身分證字號、完整病歷、非必要醫療資訊或與教學支持無關的敏感內容。' : '展示模式，禁止輸入真實學生資料。'}</p>
    </section>
  )
}
