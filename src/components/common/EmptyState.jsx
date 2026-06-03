export default function EmptyState({ icon = '📭', title, message, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <span className="text-5xl mb-4">{icon}</span>
      <h3 className="text-lg font-bold text-zinc-300 mb-1">{title}</h3>
      {message && <p className="text-sm text-zinc-500 mb-6 max-w-xs">{message}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold uppercase tracking-wider rounded-lg transition"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
