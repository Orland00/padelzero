/**
 * PlayerNoteForm
 *
 * Coach note entry form: free-text textarea + predefined skill tag chips
 * + share toggle. On submit calls crmStore.saveNote.
 *
 * Updated: 2026-05-07
 */
import React, { useState } from 'react'
import { useCrmStore, PREDEFINED_TAGS } from '@/stores/crmStore'
import { useAuthStore } from '@/stores/authStore'
import { useUiStore } from '@/stores/uiStore'
import { useI18n } from '@/lib/i18n'

/**
 * @param {Object}   props
 * @param {string}   props.targetId   - Student's profile ID
 * @param {Function} props.onSaved    - Called after successful save
 *
 * Updated: 2026-05-07
 */
export default function PlayerNoteForm({ targetId, onSaved }) {
  const { user } = useAuthStore()
  const { saveNote } = useCrmStore()
  const { showToast } = useUiStore()
  const { lang } = useI18n()
  const es = lang === 'es'

  const [content, setContent] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [isShared, setIsShared] = useState(false)
  const [saving, setSaving] = useState(false)

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    )
  }

  const handleSubmit = async () => {
    if (!content.trim() || !user?.id || saving) return
    setSaving(true)

    const { error } = await saveNote({
      authorId: user.id,
      targetId,
      content: content.trim(),
      tags: selectedTags,
      isShared,
    })

    setSaving(false)

    if (error) {
      showToast(es ? 'Error al guardar nota' : 'Error saving note', 'error')
      return
    }

    setContent('')
    setSelectedTags([])
    setIsShared(false)
    showToast(es ? 'Nota guardada ✓' : 'Note saved ✓', 'success')
    onSaved?.()
  }

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/70 p-4 space-y-4">
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        rows={4}
        placeholder={es
          ? 'Ej: Bandeja inconsistente en defensa. Trabajar transferencia de peso…'
          : 'E.g. Inconsistent bandeja on defense. Work on weight transfer…'}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 resize-none focus:outline-none focus:border-zinc-500"
      />

      {/* Tag chips */}
      <div>
        <p className="text-xs text-zinc-400 mb-2">
          {es ? 'Diagnóstico rápido' : 'Quick diagnosis'}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {PREDEFINED_TAGS.map(tag => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                selectedTags.includes(tag)
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {tag.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Share toggle + submit */}
      <div className="flex items-center justify-between pt-1 border-t border-zinc-700/50">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isShared}
            onChange={e => setIsShared(e.target.checked)}
            className="w-4 h-4 accent-emerald-500"
          />
          <span className="text-sm text-zinc-300">
            {es ? 'Compartir con alumno' : 'Share with student'}
          </span>
        </label>

        <button
          onClick={handleSubmit}
          disabled={!content.trim() || saving}
          className="px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 text-sm font-semibold hover:bg-zinc-700 transition disabled:opacity-40"
        >
          {saving ? (es ? 'Guardando…' : 'Saving…') : (es ? 'Registrar' : 'Save')}
        </button>
      </div>
    </div>
  )
}
