/**
 * AchievementsGrid Component
 *
 * Displays a 5-column grid of achievements.
 * Shows locked/unlocked state based on player_achievements data.
 *
 * Updated: 2026-05-07
 */
import { ACHIEVEMENT_META } from '@/stores/socialStore'
import AchievementBadge from '@/components/AchievementBadge'
import { useI18n } from '@/lib/i18n'

export default function AchievementsGrid({ achievements }) {
  const { lang } = useI18n()
  const es = lang === 'es'

  return (
    <section>
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">
        {es ? 'Logros' : 'Achievements'}
      </h2>
      <div className="grid grid-cols-5 gap-2">
        {Object.keys(ACHIEVEMENT_META).map(key => {
          const earned = achievements.find(a => a.achievement_key === key)
          return (
            <AchievementBadge
              key={key}
              achievementKey={key}
              unlockedAt={earned?.unlocked_at}
              locked={!earned}
            />
          )
        })}
      </div>
    </section>
  )
}
