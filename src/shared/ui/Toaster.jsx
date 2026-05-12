import { useState, useEffect } from 'react'
import { subscribeToasts, dismissToast } from '@/shared/lib/toast'
import { X, WifiOff, AlertCircle, CheckCircle } from 'lucide-react'

const ICONS = {
  error:   <WifiOff size={16} className="shrink-0 text-red-400" />,
  warn:    <AlertCircle size={16} className="shrink-0 text-amber-400" />,
  success: <CheckCircle size={16} className="shrink-0 text-emerald-400" />,
}

const STYLES = {
  error:   'bg-[#1a1a1a] border-red-900/60 text-white',
  warn:    'bg-[#1a1a1a] border-amber-900/60 text-white',
  success: 'bg-[#1a1a1a] border-emerald-900/60 text-white',
}

export function Toaster() {
  const [toasts, setToasts] = useState([])

  useEffect(() => subscribeToasts(setToasts), [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-2xl border shadow-2xl text-sm font-medium pointer-events-auto max-w-sm w-max
            ${STYLES[t.type] ?? STYLES.error}
            animate-in fade-in slide-in-from-bottom-4 duration-300`}
        >
          {ICONS[t.type] ?? ICONS.error}
          <span className="flex-1 min-w-0">{t.message}</span>
          <button
            onClick={() => dismissToast(t.id)}
            className="ml-1 p-0.5 rounded-full opacity-50 hover:opacity-100 transition-opacity"
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
