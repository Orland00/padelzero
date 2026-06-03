/**
 * Americano Padel League Engine
 * Rotation algorithm, round calculator, point accumulation
 */

/**
 * Task 9: Generate Americano rounds using circle method
 * Every player partners with every other player (if rounds allow)
 * Every player plays against every other player (if rounds allow)
 *
 * @param {string[]} playerIds - Array of player UUIDs
 * @param {number} maxRounds - Optional cap on rounds
 * @returns {Array} Rounds with matches, bye rotation
 *
 * Example:
 * generateAmericanoRounds(['p1', 'p2', ..., 'p8'], 7)
 * → [
 *     { round: 1, matches: [{court: 1, teamA: ['p1','p2'], teamB: ['p3','p4']}, ...], bye: null },
 *     { round: 2, matches: [...], bye: 'p1' },
 *     ...
 *   ]
 */
export function generateAmericanoRounds(playerIds, maxRounds = null) {
  const n = playerIds.length
  const hasOdd = n % 2 === 1
  const activePlayerCount = hasOdd ? n - 1 : n

  // Calculate default rounds (round-robin: N-1 for even, N for odd)
  const defaultRounds = hasOdd ? n : n - 1
  // H3 fix: `||` treats maxRounds=0 as falsy → falls back to defaultRounds.
  // Use `??` so caller can explicitly request 0 or more rounds. Guard final
  // value against negatives and over-cap.
  const requested = maxRounds ?? defaultRounds
  const roundCount = Math.max(0, Math.min(requested, defaultRounds))

  const rounds = []
  let byeRotation = 0

  for (let r = 0; r < roundCount; r++) {
    const round = { round: r + 1, matches: [], bye: null }

    // Rotate players for this round (except player 0 who is fixed)
    const rotated = rotatePlayersForRound(playerIds, r, hasOdd)
    const activePlayers = hasOdd ? rotated.slice(0, -1) : rotated

    // Handle bye
    if (hasOdd) {
      round.bye = rotated[rotated.length - 1]
    }

    // Generate matches: pair players using circle method
    // For N active players, create N/4 matches (each match = 4 players)
    // Pair i with N-1-i to form teams, then pair consecutive teams
    const pairs = []
    for (let i = 0; i < activePlayerCount / 2; i++) {
      pairs.push([activePlayers[i], activePlayers[activePlayerCount - 1 - i]])
    }

    // Group pairs into matches (2 pairs per match = 4 players)
    for (let i = 0; i < pairs.length; i += 2) {
      if (i + 1 < pairs.length) {
        round.matches.push({
          court: Math.floor(i / 2) + 1,
          teamA: pairs[i],
          teamB: pairs[i + 1],
        })
      }
    }

    rounds.push(round)
  }

  return rounds
}

/**
 * Rotate players for a given round.
 *
 * - Even N: classic circle method. Player 0 is fixed at slot 0; the other
 *   N-1 players rotate around the circle. Every player ends up paired with
 *   every other player across N-1 rounds.
 * - Odd N: ALL players rotate through every position. The last slot is the
 *   bye for that round, so each player gets exactly one bye across N rounds.
 *   (The old implementation also fixed player 0, which meant player 0 NEVER
 *    got a bye while every other player got one — audit H2.)
 */
function rotatePlayersForRound(playerIds, roundIndex, hasOdd) {
  const n = playerIds.length
  if (roundIndex === 0) return [...playerIds]

  if (hasOdd) {
    // Rotate the entire array left by `roundIndex`. This guarantees every
    // player ends up at the last (bye) slot exactly once across N rounds.
    const offset = roundIndex % n
    return [...playerIds.slice(offset), ...playerIds.slice(0, offset)]
  }

  // Even N: fix player 0 and rotate the rest.
  const fixed = playerIds[0]
  const rotating = playerIds.slice(1)
  const rotated = [
    ...rotating.slice(-roundIndex),
    ...rotating.slice(0, rotating.length - roundIndex),
  ]
  return [fixed, ...rotated]
}

/**
 * Generate a complete Americano schedule with preview data
 * Wraps generateAmericanoRounds and adds metadata for UI display
 *
 * @param {Array<{id: string, name: string}>} players - Players with id and display name
 * @param {number} maxRounds - Optional cap on rounds
 * @returns {{ rounds: Array, totalRounds: number, playerCount: number, hasOdd: boolean }}
 */
export function generateAmericanoSchedule(players, maxRounds = null) {
  const playerIds = players.map(p => p.id)
  const rounds = generateAmericanoRounds(playerIds, maxRounds)
  const nameMap = Object.fromEntries(players.map(p => [p.id, p.name]))

  const previewRounds = rounds.map(round => ({
    ...round,
    matches: round.matches.map(m => ({
      ...m,
      teamANames: m.teamA.map(id => nameMap[id] || '?'),
      teamBNames: m.teamB.map(id => nameMap[id] || '?'),
    })),
    byeName: round.bye ? nameMap[round.bye] || '?' : null,
  }))

  return {
    rounds: previewRounds,
    rawRounds: rounds,
    totalRounds: rounds.length,
    playerCount: players.length,
    hasOdd: players.length % 2 === 1,
  }
}

/**
 * Task 10: Calculate recommended rounds + duration
 *
 * @param {number} playerCount - Number of players
 * @param {number} maxRounds - Optional cap
 * @returns {object} { recommendedRounds, estimatedMinutes, note }
 */
export function calculateRounds(playerCount, maxRounds = null) {
  const isOdd = playerCount % 2 === 1
  const defaultRounds = isOdd ? playerCount : playerCount - 1

  const recommendedRounds = maxRounds
    ? Math.min(maxRounds, defaultRounds)
    : defaultRounds

  const estimatedMinutes = recommendedRounds * 15

  const note =
    recommendedRounds < defaultRounds
      ? `Consider capping at ${recommendedRounds} rounds (${estimatedMinutes} min) instead of ideal ${defaultRounds} rounds`
      : recommendedRounds > 10
      ? `${recommendedRounds} rounds recommended (${estimatedMinutes} min). Consider 2 sessions or splitting players.`
      : null

  return {
    recommendedRounds,
    estimatedMinutes,
    note,
  }
}

/**
 * Task 11: Calculate Americano points from matches
 * Each player gets points = games their team won
 * Example: If you win 21-15, 21-18, 21-10 you get 63 points
 *
 * @param {Array} matches - Array of match objects with score_team_a, score_team_b, players
 * @returns {object} { playerId: totalPoints }
 *
 * Match format:
 * {
 *   team_a_player1: uuid,
 *   team_a_player2: uuid,
 *   team_b_player1: uuid,
 *   team_b_player2: uuid,
 *   score_team_a: 21,
 *   score_team_b: 15
 * }
 */
export function calculateJornadaPoints(matches) {
  const pointsByPlayer = {}

  matches.forEach(match => {
    const { team_a_player1, team_a_player2, team_b_player1, team_b_player2, score_team_a, score_team_b } = match

    // Initialize players if not present
    ;[team_a_player1, team_a_player2, team_b_player1, team_b_player2].forEach(pid => {
      if (!pointsByPlayer[pid]) pointsByPlayer[pid] = 0
    })

    // Award points: each player gets the games their team won
    if (score_team_a > score_team_b) {
      // Team A wins
      pointsByPlayer[team_a_player1] += score_team_a
      pointsByPlayer[team_a_player2] += score_team_a
    } else if (score_team_b > score_team_a) {
      // Team B wins
      pointsByPlayer[team_b_player1] += score_team_b
      pointsByPlayer[team_b_player2] += score_team_b
    } else {
      // Draw (rare in padel but possible in practice/friendlies)
      pointsByPlayer[team_a_player1] += score_team_a
      pointsByPlayer[team_a_player2] += score_team_a
      pointsByPlayer[team_b_player1] += score_team_b
      pointsByPlayer[team_b_player2] += score_team_b
    }
  })

  return pointsByPlayer
}

/**
 * Task 11 (alternative): Point accumulation using fixed point system
 * Win = 3 pts, Draw = 1 pt, Loss = 0 pts
 *
 * @param {Array} matches - Array of match objects
 * @param {object} pointConfig - { win: 3, draw: 1, loss: 0 }
 * @returns {object} { playerId: totalPoints }
 */
export function calculateJornadaPointsAlternative(
  matches,
  pointConfig = { win: 3, draw: 1, loss: 0 }
) {
  const pointsByPlayer = {}

  matches.forEach(match => {
    const { team_a_player1, team_a_player2, team_b_player1, team_b_player2, score_team_a, score_team_b } = match

    // Initialize players
    ;[team_a_player1, team_a_player2, team_b_player1, team_b_player2].forEach(pid => {
      if (!pointsByPlayer[pid]) pointsByPlayer[pid] = 0
    })

    // Determine winner and assign points
    if (score_team_a > score_team_b) {
      // Team A wins
      pointsByPlayer[team_a_player1] += pointConfig.win
      pointsByPlayer[team_a_player2] += pointConfig.win
      pointsByPlayer[team_b_player1] += pointConfig.loss
      pointsByPlayer[team_b_player2] += pointConfig.loss
    } else if (score_team_b > score_team_a) {
      // Team B wins
      pointsByPlayer[team_b_player1] += pointConfig.win
      pointsByPlayer[team_b_player2] += pointConfig.win
      pointsByPlayer[team_a_player1] += pointConfig.loss
      pointsByPlayer[team_a_player2] += pointConfig.loss
    } else {
      // Draw
      ;[team_a_player1, team_a_player2, team_b_player1, team_b_player2].forEach(pid => {
        pointsByPlayer[pid] += pointConfig.draw
      })
    }
  })

  return pointsByPlayer
}

/**
 * Task 12: Calculate bye round scoring
 * Player on bye gets average of all other players' points in that round
 *
 * @param {Array} matchesInRound - Matches from one round
 * @returns {number} Average points (rounded)
 */
export function calculateByePoints(matchesInRound) {
  const allScores = []

  matchesInRound.forEach(match => {
    allScores.push(match.score_team_a || 0)
    allScores.push(match.score_team_b || 0)
  })

  if (allScores.length === 0) return 0

  const average = allScores.reduce((a, b) => a + b, 0) / allScores.length
  return Math.round(average)
}

/**
 * Smoke test helper: validate round generation
 */
export function validateRounds(rounds, playerCount) {
  const errors = []

  // Check all rounds have unique numbers
  const roundNums = rounds.map(r => r.round)
  if (new Set(roundNums).size !== roundNums.length) {
    errors.push('Duplicate round numbers')
  }

  // Check no player appears twice in same round
  rounds.forEach(round => {
    const players = new Set()
    round.matches.forEach(match => {
      ;[...match.teamA, ...match.teamB].forEach(pid => {
        if (players.has(pid)) {
          errors.push(`Round ${round.round}: Player ${pid} appears twice`)
        }
        players.add(pid)
      })
    })

    // If there's a bye, that player shouldn't be in matches
    if (round.bye) {
      const playerInMatches = round.matches.some(m =>
        [...m.teamA, ...m.teamB].includes(round.bye)
      )
      if (playerInMatches) {
        errors.push(`Round ${round.round}: Bye player ${round.bye} is in a match`)
      }
    }
  })

  return {
    valid: errors.length === 0,
    errors,
  }
}
