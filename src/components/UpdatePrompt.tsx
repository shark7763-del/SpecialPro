export function UpdatePrompt({ visible, onUpdate }: { visible: boolean; onUpdate: () => void }) {
  if (!visible) return null
  return (
    <div className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-xl rounded-2xl border border-teal-200 bg-white p-4 shadow-lg">
      <p className="font-black text-slate-900">已有新版本</p>
      <p className="mt-1 text-sm text-slate-600">點擊更新後會重新載入 SpecialPro。</p>
      <button onClick={onUpdate} className="mt-3 w-full rounded-xl bg-teal-600 px-4 py-3 font-black text-white">更新並重新載入</button>
    </div>
  )
}
