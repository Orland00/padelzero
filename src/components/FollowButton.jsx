/**
 * FollowButton
 *
 * Follow/unfollow toggle with optimistic update via socialStore.
 * Shows follower count. Hidden on own profile.
 *
 * Updated: 2026-05-08
 */
import React, { useEffect } from 'react'
import { useSocialStore } from '@/stores/socialStore'
import { useAuthStore } from '@/stores/authStore'
import { useI18n } from '@/lib/i18n'

/**
 * @param {Object}  props
 * @param {string}  props.targetId  - Profile ID to follow/unfollow
 *
 * Updated: 2026-05-08
 */
export default function FollowButton({ targetId }) {
  const { user } = useAuthStore()
  const { following, followersCount, follow, unfollow, loadFollowersCount } = useSocialStore()
  const { lang } = useI18n()
  const es = lang === 'es'

  const isFollowing = following.includes(targetId)

  useEffect(() => {
    if (targetId) loadFollowersCount(targetId)
  }, [targetId])

  if (!user?.id || user.id === targetId) return null

  const handleToggle = async () => {
    if (isFollowing) {
      await unfollow(user.id, targetId)
    } else {
      await follow(user.id, targetId)
    }
  }

  return (
    <button
      onClick={handleToggle}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition ${
        isFollowing
          ? 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
          : 'bg-emerald-600/20 border border-emerald-600/40 text-emerald-400 hover:bg-emerald-600/30'
      }`}
    >
      {isFollowing ? (es ? 'Siguiendo' : 'Following') : (es ? 'Seguir' : 'Follow')}
      {followersCount > 0 && <span className="text-xs opacity-60">{followersCount}</span>}
    </button>
  )
}
