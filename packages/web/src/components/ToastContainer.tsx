import { useToastStore } from '@/stores/toast'

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore()
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="alert"
          className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg dark:shadow-gray-900/50 ${
            t.type === 'error' ? 'bg-red-600' : 'bg-green-600'
          }`}
          onClick={() => removeToast(t.id)}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
