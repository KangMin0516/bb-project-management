import { useEffect, useState } from 'react'
import { useToastStore, type Toast } from '@/stores/toast'

const TYPE_CLASSES: Record<Toast['type'], string> = {
  error: 'bg-red-600',
  success: 'bg-green-600',
  info: 'bg-gray-800 dark:bg-gray-700',
}

/**
 * Live countdown for action toasts. Returns the seconds remaining (rounded up,
 * for the "(Ns)" label) and the elapsed ratio in [0,1] (for the progress bar).
 * Computing `Date.now()` is kept inside the effect to satisfy
 * react-hooks/purity — render reads only state.
 */
function useCountdown(startedAt: number, durationMs: number) {
  const [{ secondsLeft, ratio }, setState] = useState(() => ({ secondsLeft: Math.ceil(durationMs / 1000), ratio: 0 }))
  useEffect(() => {
    const update = () => {
      const elapsed = Date.now() - startedAt
      const remainingMs = Math.max(0, durationMs - elapsed)
      setState({
        secondsLeft: Math.ceil(remainingMs / 1000),
        ratio: Math.max(0, Math.min(1, elapsed / durationMs)),
      })
    }
    update()
    const id = setInterval(update, 200)
    return () => clearInterval(id)
  }, [startedAt, durationMs])
  return { secondsLeft, ratio }
}

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useToastStore((s) => s.removeToast)
  const { secondsLeft, ratio: progress } = useCountdown(toast.startedAt, toast.durationMs)

  return (
    <div
      role="alert"
      className={`relative overflow-hidden flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg dark:shadow-gray-900/50 ${TYPE_CLASSES[toast.type]}`}
    >
      <span className="flex-1">{toast.message}</span>
      {toast.action ? (
        <button
          onClick={toast.action.onAction}
          className="rounded px-2 py-1 text-xs font-semibold underline-offset-2 hover:underline focus:outline-none focus:ring-2 focus:ring-white/50"
        >
          {toast.action.label}
          {secondsLeft > 0 ? ` (${secondsLeft}s)` : ''}
        </button>
      ) : (
        <button
          onClick={() => removeToast(toast.id)}
          aria-label="Dismiss"
          className="text-white/70 hover:text-white"
        >
          ✕
        </button>
      )}
      {toast.action ? (
        <span
          className="absolute bottom-0 left-0 h-0.5 bg-white/60 transition-[width] duration-200 ease-linear"
          style={{ width: `${(1 - progress) * 100}%` }}
        />
      ) : null}
    </div>
  )
}

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2 w-[22rem]">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}
