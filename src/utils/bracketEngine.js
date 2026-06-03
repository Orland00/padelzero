/**
 * Bracket Engine — Level-Balanced Team Generation
 *
 * Uses a snake-draft algorithm to distribute players into pairs:
 *   1. Sort players by level descending.
 *   2. Pair position i with position (n-1-i) — strongest with weakest.
 *   3. Odd players receive a bye (advances automatically to next round).
 *
 * This is a pure function — no Supabase calls, no React.
 *
 * Updated: 2026-05-08
 */

/**
 * Generate balanced bracket pairs from a list of players.
 *
 * @param {Array<{id: string, level: number}>} players
 * @returns {{ pairs: Array<[player, player]>, byes: Array<player> }}
 *
 * Updated: 2026-05-08
 */
export function generateBalancedBracket(players) {
  if (!players || players.length < 2) {
    throw new Error('Need at least 2 players to generate a bracket')
  }

  // Sort descending by level (highest skill first)
  const sorted = [...players].sort((a, b) => b.level - a.level)

  // Odd count: the weakest player (last after sort) gets a bye
  const byes = []
  if (sorted.length % 2 !== 0) {
    byes.push(sorted.pop())
  }

  // Snake-draft: pair index i with index (n-1-i)
  // Strongest (0) pairs with weakest (n-1), next-strongest (1) with (n-2), etc.
  // This balances team averages by pairing across the skill spread.
  const half = sorted.length / 2
  const pairs = []
  for (let i = 0; i < half; i++) {
    pairs.push([sorted[i], sorted[sorted.length - 1 - i]])
  }

  return { pairs, byes }
}

/**
 * Assign byes to the next round of a bracket.
 * Players with byes are auto-advanced without playing.
 *
 * @param {Array<player>} byes
 * @returns {Array<{ player: player, round: number }>}
 *
 * Updated: 2026-05-08
 */
export function assignByes(byes) {
  return byes.map(player => ({ player, round: 2 }))
}
