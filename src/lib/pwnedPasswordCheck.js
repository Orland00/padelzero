/**
 * HaveIBeenPwned k-anonymity password check.
 *
 * Protocol (documented at https://haveibeenpwned.com/API/v3#PwnedPasswords):
 *   1. Client computes SHA-1 of the password.
 *   2. Client sends only the first 5 hex chars of the hash to the API.
 *   3. API returns all hashes that share that 5-char prefix (~500-1000 rows).
 *   4. Client searches for its own suffix locally. API never learns the password
 *      nor the full hash.
 *
 * This replaces Supabase's Pro-plan-only HIBP toggle with a free client-side
 * check. We hit the endpoint with `Add-Padding: true` so response size is
 * constant and network observers can't infer match count from bandwidth.
 *
 * Fails open: if the HIBP API is down, we let the signup proceed rather than
 * blocking users on a third-party outage.
 */

const HIBP_RANGE_ENDPOINT = 'https://api.pwnedpasswords.com/range/'

async function sha1Hex(input) {
  const buffer = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

/**
 * Parse HIBP range response (lines of "SUFFIX:COUNT") and find the breach
 * count for a given suffix. Padded rows show COUNT=0 and are safely ignored.
 * @param {string} body
 * @param {string} suffix — 35 uppercase hex chars (SHA-1 minus prefix)
 * @returns {number} — 0 if not found or padding, else real breach count
 */
export function findBreachCount(body, suffix) {
  if (!body || !suffix) return 0
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue
    const [sfx, countRaw] = line.split(':')
    if (sfx && sfx.toUpperCase() === suffix) {
      const count = parseInt(countRaw, 10)
      return Number.isFinite(count) ? count : 0
    }
  }
  return 0
}

/**
 * Check whether a password appears in known breach corpora.
 * @param {string} password
 * @returns {Promise<{ pwned: boolean, count: number, checked: boolean }>}
 *   checked=false when the API was unreachable (fail-open signal).
 */
export async function checkPasswordPwned(password) {
  if (!password || typeof password !== 'string') {
    return { pwned: false, count: 0, checked: true }
  }

  try {
    const hash = await sha1Hex(password)
    const prefix = hash.slice(0, 5)
    const suffix = hash.slice(5)

    const res = await fetch(HIBP_RANGE_ENDPOINT + prefix, {
      headers: { 'Add-Padding': 'true' },
    })
    if (!res.ok) return { pwned: false, count: 0, checked: false }
    const body = await res.text()
    const count = findBreachCount(body, suffix)
    return { pwned: count > 0, count, checked: true }
  } catch {
    // Network error / DNS / abort: fail open.
    return { pwned: false, count: 0, checked: false }
  }
}
