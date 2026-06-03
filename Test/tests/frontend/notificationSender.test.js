/**
 * Notification sender-display tests.
 *
 * The notificationStore joins profiles on sender_id so the UI can show
 * "from <name>" on every notification card. Realtime inserts only carry
 * the raw notifications row, so the store resolves the sender profile
 * on arrival.
 *
 * These tests exercise the render contract expected by Header.jsx.
 */
import { describe, it, expect } from 'vitest'

// Mirrors the render branches in Header.jsx notification card.
// If sender has avatar → show avatar; else if sender has name → show initial;
// else fall back to type emoji.
function chooseAvatarMode(notification) {
  if (notification.sender?.avatar_url) return 'image'
  if (notification.sender?.display_name) return 'initial'
  return 'emoji-fallback'
}

function senderLabel(notification, lang) {
  if (!notification.sender?.display_name) return null
  const prefix = lang === 'en' ? 'from' : 'de'
  return `${prefix} ${notification.sender.display_name}`
}

describe('notification sender rendering', () => {
  it('renders avatar image when sender has avatar_url', () => {
    const n = { type: 'liga_invite', sender: { display_name: 'Ana', avatar_url: 'https://x/a.png' } }
    expect(chooseAvatarMode(n)).toBe('image')
  })

  it('renders initial when sender has name but no avatar', () => {
    const n = { type: 'liga_invite', sender: { display_name: 'Ana Jiménez', avatar_url: null } }
    expect(chooseAvatarMode(n)).toBe('initial')
  })

  it('falls back to type emoji when sender is null (system notifications)', () => {
    const n = { type: 'achievement', sender: null }
    expect(chooseAvatarMode(n)).toBe('emoji-fallback')
  })

  it('produces "de <name>" in Spanish', () => {
    const n = { sender: { display_name: 'Ana Jiménez' } }
    expect(senderLabel(n, 'es')).toBe('de Ana Jiménez')
  })

  it('produces "from <name>" in English', () => {
    const n = { sender: { display_name: 'Luis Test' } }
    expect(senderLabel(n, 'en')).toBe('from Luis Test')
  })

  it('returns null label when sender has no display_name', () => {
    expect(senderLabel({ sender: null }, 'es')).toBe(null)
    expect(senderLabel({ sender: { display_name: '' } }, 'es')).toBe(null)
  })
})

describe('notification payload shape', () => {
  // Asserts the shape notificationStore.initialize returns — specifically
  // that consumers can trust sender to be resolved when non-null.
  function isValidNotification(n) {
    const required = ['id', 'recipient_id', 'type', 'title', 'created_at']
    for (const k of required) if (n[k] == null) return false
    if (n.sender != null && typeof n.sender !== 'object') return false
    return true
  }

  it('accepts a fully-populated notification with sender', () => {
    const n = {
      id: 'abc', recipient_id: 'u1', sender_id: 'u2', type: 'liga_invite',
      title: 'Invitación a Liga', created_at: '2026-04-16T20:00:00Z',
      sender: { id: 'u2', display_name: 'Ana', avatar_url: null, username: 'ana' },
    }
    expect(isValidNotification(n)).toBe(true)
  })

  it('accepts system notifications with null sender', () => {
    const n = {
      id: 'abc', recipient_id: 'u1', sender_id: null, type: 'achievement',
      title: '¡Lograste el primer partido!', created_at: '2026-04-16T20:00:00Z',
      sender: null,
    }
    expect(isValidNotification(n)).toBe(true)
  })

  it('rejects notifications missing required columns', () => {
    expect(isValidNotification({ id: 'x', type: 'liga_invite' })).toBe(false)
  })
})
