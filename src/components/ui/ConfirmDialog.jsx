import { useEffect } from 'react'
import { useUiStore } from '@/stores/uiStore'
import { useI18n } from '@/lib/i18n'

/**
 * Global confirm dialog — reads `confirmDialog` from uiStore.
 * Replaces native window.confirm() which has poor PWA UX on iOS.
 * Mount ONCE at the app root (e.g. inside App.jsx under the router).
 */
export default function ConfirmDialog() {
  const confirmDialog = useUiStore((s) => s.confirmDialog)
  const { lang } = useI18n()
  const es = lang === 'es'

  useEffect(() => {
    if (!confirmDialog) return
    // Keyboard: Escape cancels, Enter confirms
    const onKey = (e) => {
      if (e.key === 'Escape') confirmDialog.onCancel()
      if (e.key === 'Enter') confirmDialog.onConfirm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmDialog])

  if (!confirmDialog) return null

  const { title, message, confirmText, cancelText, danger, onConfirm, onCancel } = confirmDialog
  const confirmLabel = confirmText || (es ? 'Confirmar' : 'Confirm')
  const cancelLabel = cancelText || (es ? 'Cancelar' : 'Cancel')

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        role="document"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-5"
      >
        {title && (
          <h2 className="text-base font-black text-zinc-100 mb-2">{title}</h2>
        )}
        <p className="text-sm text-zinc-300 whitespace-pre-line">{message}</p>
        <div className="mt-5 flex gap-2 justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-200 text-xs font-bold uppercase tracking-widest hover:bg-zinc-700 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className={
              danger
                ? 'px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-bold uppercase tracking-widest hover:bg-red-500/30 transition-colors'
                : 'px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold uppercase tracking-widest hover:bg-emerald-500/30 transition-colors'
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
