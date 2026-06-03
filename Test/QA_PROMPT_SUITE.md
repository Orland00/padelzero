# PadelZero.win: Unit Testing Prompt Suite (v1.0)

This document contains specialized "Super Power" prompts for Claude Code or Gemini Sub-Agents to generate high-rigor unit tests for the PadelZero.win roadmap. 

**Model your execution after the 'Demo Brand' QA strategy:**
1.  **Isolation:** Mock 100% of Supabase, Cloudflare, and external browser globals.
2.  **Logic-First:** Focus on business rule validation (ELO bounds, confirmation logic) rather than UI snapshots.
3.  **Boundary Testing:** Test the "0.0" and "7.0" level limits and "Matches < 15" provisional states.

---

## 🧪 PROMPT 1: Player Foundation & ELO Logic (Sprint 1)

> **Role:** Senior QA Engineer (Logic & Math)
> **Mission:** Test the 'Player Foundation' core logic.
> **Files to Analyze:** `src/utils/eloEngine.js`, `src/stores/playerStore.js` (or similar).
> **Tasks:**
> 1. Create a unit test file `tests/unit/elo-calculations.test.js`.
> 2. Test the `eloToLevel` utility function. Verify:
>    - ELO 800 maps to 0.0.
>    - ELO 2400 (or max) maps to 7.0.
>    - Floating point rounding to 2 decimal places.
> 3. Test `Match Confirmation` logic in the store:
>    - Mock `supabase.rpc('confirm_match_and_update_ratings')`.
>    - Verify that a confirmation from Team A correctly triggers the RPC only if a player from Team B is also involved.
>    - Verify "Provisional Badge" logic: Ensure a flag `isProvisional: true` is returned if `matches_count < 15`.
> **Constraint:** Use Vitest. Mock the entire `@supabase/supabase-js` client.

---

## 🧪 PROMPT 2: Tournament Bracket & Snake Draft (Sprint 3)

> **Role:** Senior QA Engineer (Algorithms)
> **Mission:** Test the 'Tournament Pro' bracket generation.
> **Files to Analyze:** `src/utils/bracketEngine.js`.
> **Tasks:**
> 1. Create a unit test file `tests/unit/bracket-engine.test.js`.
> 2. Test the `generateBalancedBracket` algorithm:
>    - Input: A list of 8 players with diverse levels (e.g., 1.5, 3.2, 5.0, 6.1).
>    - Assertion: Verify the "Snake Draft" logic ensures the team-average ELOs are within ±5% of each other.
>    - Edge Case: Test with an odd number of players (verify "BYE" assignment).
>    - Edge Case: Test with all players at Level 1.0 (verify stable sorting).
> **Constraint:** Zero network calls. Pure algorithmic verification.

---

## 🧪 PROMPT 3: Open Match & Level Filters (Sprint 2)

> **Role:** Senior QA Engineer (Filtering & Persistence)
> **Mission:** Test the 'Open Matches' feed logic.
> **Files to Analyze:** `src/stores/openMatchStore.js`.
> **Tasks:**
> 1. Create a unit test file `tests/unit/open-matches.test.js`.
> 2. Test the `filterByLevel` function:
>    - User level is 3.5. Feed contains levels [3.0, 3.5, 4.0, 5.0].
>    - Assertion: Only [3.0, 3.5, 4.0] are returned (Range ±0.5).
> 3. Test `Join Slot` logic:
>    - Mock an initial match with `slots_needed: 2`.
>    - Simulate joining. Verify `slots_needed` decrements correctly in the local store before the Supabase write completes (optimistic update).
> **Constraint:** Mock Zustand state and Supabase Realtime subscriptions.

---

## 🧪 PROMPT 4: CRM Privacy Guard & RBAC (S5)

> **Role:** Senior Security Auditor & QA
> **Mission:** Test the 'Coach CRM' Privacy Guard.
> **Files to Analyze:** `src/stores/crmStore.js`, `api/src/middleware/auth.ts`.
> **Tasks:**
> 1. Create a unit test file `tests/unit/crm-privacy.test.js`.
> 2. Test the `Note Visibility` logic:
>    - Scenario: Coach creates a note for Player X with `is_shared: false`.
>    - Assertion: When playerStore (mocked as Player X) attempts to read, the list is empty.
>    - Scenario: Coach marks note as `is_shared: true`.
>    - Assertion: Player X can now see the content.
> 3. Test `Heavy User Score` recomputation:
>    - Verify the formula `(freq_classes * 2) + total_spend/100` calculates correctly for 10 classes and $1000 spend.
> **Constraint:** Verify RLS-like logic at the store level (pre-server check).

---

## 🧪 PROMPT 5: Social Feed & Achievement Triggers (Sprint 4)

> **Role:** Senior QA Engineer (Events)
> **Mission:** Test the 'Social Layer' event stream.
> **Files to Analyze:** `src/stores/socialStore.js`.
> **Tasks:**
> 1. Create a unit test file `tests/unit/social-achievements.test.js`.
> 2. Test `Achievement Unlock` conditions:
>    - Input: Rating history update where `elo_after >= 2000`.
>    - Assertion: `unlockAchievement('leyenda')` is called.
>    - Input: 5th consecutive win in history.
>    - Assertion: `unlockAchievement('racha_5')` is called.
> 3. Test `Feed Ordering`:
>    - Ensure matches from multiple followed players are sorted by `played_at` DESC.
> **Constraint:** Mock the trigger-firing mechanism.
