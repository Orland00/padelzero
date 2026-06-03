/**
 * PlayerProgressCard
 *
 * Shows a student's coaching stats: attendance ratio, level trend,
 * and any shared notes visible to the student.
 *
 * Updated: 2026-05-07
 */
import React from 'react'
import PlayerLevelBadge from '@/components/PlayerLevelBadge'
import { useI18n } from '@/lib/i18n'

/**
 * @param {Object}  props
 * @param {Object}  props.profile            - Student profile row
 * @param {Array}   props.notes              - Coach notes (filtered by caller)
 * @param {number}  props.classesTaken
 * @param {number}  props.classesCancelled
 *
 * Updated: 2026-05-07
 */
export default function PlayerProgressCard({ profile, notes, classesTaken, classesCancelled }) {
  const { lang } = useI18n()
  const es = lang === 'es'

  const total = classesTaken + classesCancelled
  const attendanceRate = total > 0 ? Math.round((classesTaken / total) * 100) : null

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/70 p-4 space-y-4">
      {/* Student header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-zinc-700 flex items-center justify-center font-bold text-zinc-300">
          {profile?.display_name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        <div>
          <p className="font-semibold text-zinc-200">{profile?.display_name}</p>
          {profile?.level != null && (
            <PlayerLevelBadge level={profile.level} matchesPlayed={profile.matches_played} size="sm" />
          )}
        </div>
      </div>

      {/* Attendance ratio bar */}
      {attendanceRate != null && (
        <div>
          <div className="flex justify-between text-xs text-zinc-400 mb-1">
            <span>{es ? 'Asistencia' : 'Attendance'}</span>
            <span>{attendanceRate}%</span>
          </div>
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                attendanceRate >= 80 ? 'bg-emerald-500' :
                attendanceRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${attendanceRate}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500 mt-1">
            {classesTaken} {es ? 'tomadas' : 'taken'} / {classesCancelled} {es ? 'canceladas' : 'cancelled'}
          </p>
        </div>
      )}

      {/* Shared notes visible to student */}
      {notes.filter(n => n.is_shared).length > 0 && (
        <div>
          <p className="text-xs text-zinc-400 font-semibold mb-2">
            {es ? 'Feedback del coach' : 'Coach feedback'}
          </p>
          {notes.filter(n => n.is_shared).slice(0, 3).map(note => (
            <div key={note.id} className="text-sm text-zinc-300 bg-zinc-800/50 rounded-lg p-2 mb-1">
              {note.content}
              {note.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {note.tags.map(t => (
                    <span key={t} className="text-[10px] bg-blue-900/40 text-blue-300 px-1.5 py-0.5 rounded">
                      {t.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
