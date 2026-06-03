export function SkeletonLine({ width = 'w-full', height = 'h-4' }) {
  return <div className={`${width} ${height} bg-zinc-800 rounded animate-pulse`} />
}

export function SkeletonCard() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
      <SkeletonLine width="w-2/3" height="h-5" />
      <SkeletonLine width="w-full" />
      <SkeletonLine width="w-1/2" />
    </div>
  )
}

export function SkeletonList({ count = 3 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3">
          <div className="w-10 h-10 bg-zinc-800 rounded-full animate-pulse" />
          <div className="flex-1 space-y-2">
            <SkeletonLine width="w-1/3" />
            <SkeletonLine width="w-2/3" height="h-3" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function LoadingSkeleton({ variant = 'list', count = 3 }) {
  if (variant === 'card') return <div className="space-y-3">{Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}</div>
  return <SkeletonList count={count} />
}
