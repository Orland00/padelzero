import { useUiStore } from '@/stores/uiStore'

/**
 * Renders the toast queue from uiStore. Before this existed, 30+ callers
 * of showToast() across src/ silently wrote to state with no visible UI —
 * every toast was swallowed. Mount once in AppShell.
 */
export default function ToastContainer() {
  const toasts = useUiStore((s) => s.toasts)
  const dismissToast = useUiStore((s) => s.dismissToast)

  if (!toasts || toasts.length === 0) return null

  return (
    <div className="fixed bottom-24 left-0 right-0 z-[90] flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismissToast(t.id)}
          className={
            'pointer-events-auto max-w-md w-full text-left px-4 py-3 rounded-xl shadow-lg text-sm font-medium border backdrop-blur-md transition-all ' +
            (t.type === 'error'
              ? 'bg-red-500/20 border-red-500/40 text-red-100'
              : t.type === 'success'
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-100'
              : t.type === 'warning'
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-100'
              : 'bg-zinc-800/90 border-zinc-700 text-zinc-100')
          }
        >
          {t.message}
        </button>
      ))}
    </div>
  )
}
