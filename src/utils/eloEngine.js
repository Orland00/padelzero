/**
 * ELO Rating Engine for Padel Doubles
 * Based on tennis doubles ELO methodology:
 * - Team rating = average of individual ratings
 * - Expected score uses standard ELO formula
 * - Each player's individual rating updates based on team result
 * 
 * Last updated: 2026-04-29
 */

const DEFAULT_ELO = 1200
const K_NEW = 40      // < 20 matches
const K_STANDARD = 32 // >= 20 matches
const MATCH_THRESHOLD = 20

/**
 * Get K-factor based on player's match count.
 * Newer players have a higher K-factor (40) to help them reach their 
 * true skill level faster. Established players use 32.
 * 
 * Updated: 2026-04-29
 */
function getK(matchesPlayed) {
  return matchesPlayed < MATCH_THRESHOLD ? K_NEW : K_STANDARD
}

/**
 * Calculate team rating from two players by averaging their ELOs.
 * 
 * Updated: 2026-04-29
 */
function teamRating(eloA, eloB) {
  return (eloA + eloB) / 2
}

/**
 * Calculate expected score for a team using the standard ELO logistic formula.
 * @returns {number} Expected probability of winning (0-1)
 * 
 * Updated: 2026-04-29
 */
function expectedScore(myTeamRating, opponentTeamRating) {
  return 1 / (1 + Math.pow(10, (opponentTeamRating - myTeamRating) / 400))
}

/**
 * Calculate ELO changes for a doubles match.
 * Calculates the delta for each player independently based on their own K-factor
 * but using the team's average ELO for expectation.
 *
 * @param {Object} params
 * @param {Object} params.winner1 - { elo: number, matches_played: number }
 * @param {Object} params.winner2 - { elo: number, matches_played: number }
 * @param {Object} params.loser1  - { elo: number, matches_played: number }
 * @param {Object} params.loser2  - { elo: number, matches_played: number }
 * @returns {Object} { winner1Delta, winner2Delta, loser1Delta, loser2Delta }
 * 
 * Updated: 2026-04-29
 */
export function calculateDoublesElo({ winner1, winner2, loser1, loser2 }) {
  const winTeamRating = teamRating(winner1.elo, winner2.elo)
  const loseTeamRating = teamRating(loser1.elo, loser2.elo)

  const expectedWin = expectedScore(winTeamRating, loseTeamRating)
  const expectedLose = 1 - expectedWin

  const winner1Delta = Math.round(getK(winner1.matches_played) * (1 - expectedWin))
  const winner2Delta = Math.round(getK(winner2.matches_played) * (1 - expectedWin))
  const loser1Delta = Math.round(getK(loser1.matches_played) * (0 - expectedLose))
  const loser2Delta = Math.round(getK(loser2.matches_played) * (0 - expectedLose))

  return {
    winner1Delta,
    winner2Delta,
    loser1Delta,
    loser2Delta,
    // Summary for display
    winnerGain: Math.round((winner1Delta + winner2Delta) / 2),
    loserLoss: Math.round((loser1Delta + loser2Delta) / 2),
    expectedWin: Math.round(expectedWin * 100),
  }
}

/**
 * High-level function to calculate ELO changes for all 4 players given match data.
 * Handles the logic of identifying winners/losers and dealing with draws.
 * Returns an array of objects containing the new ELO and the calculated delta.
 *
 * @param {Object} params
 * @param {string} params.teamAPlayer1 - player ID
 * @param {string} params.teamAPlayer2 - player ID
 * @param {string} params.teamBPlayer1 - player ID
 * @param {string} params.teamBPlayer2 - player ID
 * @param {number} params.scoreTeamA
 * @param {number} params.scoreTeamB
 * @param {Object} params.playerData - { [playerId]: { elo, matches_played } }
 * @returns {Array<{ playerId, oldElo, newElo, delta }>}
 * 
 * Updated: 2026-04-29
 */
export function calculateMatchEloChanges({
  teamAPlayer1, teamAPlayer2, teamBPlayer1, teamBPlayer2,
  scoreTeamA, scoreTeamB, playerData
}) {
  const teamAWon = scoreTeamA > scoreTeamB

  const w1 = teamAWon ? playerData[teamAPlayer1] : playerData[teamBPlayer1]
  const w2 = teamAWon ? playerData[teamAPlayer2] : playerData[teamBPlayer2]
  const l1 = teamAWon ? playerData[teamBPlayer1] : playerData[teamAPlayer1]
  const l2 = teamAWon ? playerData[teamBPlayer2] : playerData[teamAPlayer2]

  const w1Id = teamAWon ? teamAPlayer1 : teamBPlayer1
  const w2Id = teamAWon ? teamAPlayer2 : teamBPlayer2
  const l1Id = teamAWon ? teamBPlayer1 : teamAPlayer1
  const l2Id = teamAWon ? teamBPlayer2 : teamAPlayer2

  // Handle draw (no ELO change)
  if (scoreTeamA === scoreTeamB) {
    return [
      { playerId: teamAPlayer1, oldElo: playerData[teamAPlayer1].elo, newElo: playerData[teamAPlayer1].elo, delta: 0 },
      { playerId: teamAPlayer2, oldElo: playerData[teamAPlayer2].elo, newElo: playerData[teamAPlayer2].elo, delta: 0 },
      { playerId: teamBPlayer1, oldElo: playerData[teamBPlayer1].elo, newElo: playerData[teamBPlayer1].elo, delta: 0 },
      { playerId: teamBPlayer2, oldElo: playerData[teamBPlayer2].elo, newElo: playerData[teamBPlayer2].elo, delta: 0 },
    ]
  }

  const { winner1Delta, winner2Delta, loser1Delta, loser2Delta } = calculateDoublesElo({
    winner1: w1, winner2: w2, loser1: l1, loser2: l2
  })

  // Ensure ELO never drops below the floor of 800
  return [
    { playerId: w1Id, oldElo: w1.elo, newElo: Math.max(800, w1.elo + winner1Delta), delta: winner1Delta },
    { playerId: w2Id, oldElo: w2.elo, newElo: Math.max(800, w2.elo + winner2Delta), delta: winner2Delta },
    { playerId: l1Id, oldElo: l1.elo, newElo: Math.max(800, l1.elo + loser1Delta), delta: loser1Delta },
    { playerId: l2Id, oldElo: l2.elo, newElo: Math.max(800, l2.elo + loser2Delta), delta: loser2Delta },
  ]
}

/**
 * Convert ELO rating to Playtomic-style level (0.0–7.0).
 * Linear map: ELO 800 → 0.00, ELO 2400 → 7.00.
 * Clamps outside the range. Matches the DB trigger in v15_00.
 *
 * Updated: 2026-05-07
 */
export function eloToLevel(elo) {
  const raw = (elo - 800) / 1600 * 7
  return Math.round(Math.max(0, Math.min(7, raw)) * 100) / 100
}
