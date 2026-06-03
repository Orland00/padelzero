# Task 20: Comprehensive End-to-End Test Plan

**Status**: Manual Testing Guide
**Date**: March 21, 2026
**Deadline**: Monday March 24, 2026 (Play Night)
**Objective**: Validate complete Liga Acme workflow from start to finish with 8 players

---

## Quick Overview

This test simulates a real Liga Acme play session:
- **Duration**: ~90 minutes of testing
- **Setup**: 15 minutes (database, dev server, test accounts)
- **Execution**: 75 minutes (4 phases with step-by-step instructions)
- **Expected Result**: All features working, ready for Monday play

---

## Prerequisite Setup (15 minutes)

### Step 1: Verify Database Migrations

```bash
# Check that all migrations have been applied
cd /path/to/padelzero

# View migration status
ls -la supabase/migrations/v6_*.sql

# Expected files (all should exist):
# v6_01_liga_tables.sql         — 8 tables (ligas, jornadas, rounds, matches, etc.)
# v6_02_liga_rls.sql           — RLS policies enabled
# v6_03_*.sql through v6_10_*  — Additional features (if any)
```

**Expected Result**: ✅ All migration files exist

### Step 2: Start Development Server

```bash
# Terminal 1: Start dev server
cd /path/to/padelzero
npm run dev

# Watch for this output:
#   VITE v5.x.x  ready in 123 ms
#   Local:   http://localhost:5173/
```

**Expected Result**: ✅ Browser can reach http://localhost:5173

### Step 3: Create Test Accounts

Create 9 Supabase test accounts (or use existing accounts):

| Role | Account Name | Email | Purpose |
|------|-------------|-------|---------|
| Admin | Test Admin | test-admin@example.com | Liga creator |
| Player 1 | Jorge | test-player-1@example.com | Check-in + play |
| Player 2 | Maria | test-player-2@example.com | Check-in + play |
| Player 3 | Carlos | test-player-3@example.com | Check-in + play |
| Player 4 | Sofia | test-player-4@example.com | Check-in + play |
| Player 5 | Diego | test-player-5@example.com | Check-in + play |
| Player 6 | Ana | test-player-6@example.com | Check-in + play |
| Player 7 | Miguel | test-player-7@example.com | Check-in + play |
| Player 8 | Laura | test-player-8@example.com | Check-in + play |
| Outsider | Non-member | non-member@example.com | Test share link |

**How to create test accounts**:
1. Open http://localhost:5173
2. Click "Login with Google" or email signup
3. Complete onboarding (enter display name)
4. Logout
5. Repeat for each player

**Expected Result**: ✅ 9 accounts created, can switch between them

### Step 4: Prepare Browser Windows

1. **Window 1 (Main)**: Opens at 1680x1050 (desktop size)
   - Will stay logged in as Test Admin
   - Use for most steps

2. **Window 2 (Incognito)**: Opens fresh
   - Use for testing share link as non-member
   - Will login as Non-member account

3. **Console**: Open DevTools (F12) in both windows
   - Monitor for red error messages
   - Check Network tab for failed requests

**Expected Result**: ✅ Two browser windows ready, DevTools open

---

## Phase 1: Liga Setup (10 minutes)

### Step 1.1: Login as Admin

**Window 1 - Admin User**

1. Navigate to http://localhost:5173
2. Click "Login with Google"
3. Select or enter: `test-admin@example.com`
4. Complete any 2FA if required
5. Onboarding: Enter display name "Test Admin"
6. Click "Guardar Perfil"

**Expected Result**:
- ✅ Logged in, see "Inicio" (Home) page
- ✅ Profile dropdown shows "Test Admin"
- ✅ Can navigate to different pages

### Step 1.2: Create Nueva Liga

1. From Home, click **"⚽ CREAR LIGA"** button
2. Fill form:
   - **Name**: `Test Americana`
   - **Description**: `Testing check-in, rounds, and scoring`
   - **Location**: (Optional) `Padel Court`
3. Click **"CREAR"** button
4. **Wait** for page redirect (2-3 seconds)

**Expected Result**:
- ✅ Modal shows "Creando..." state briefly
- ✅ Page redirects to liga detail page
- ✅ URL shows: `http://localhost:5173/liga/<LIGA_ID>`
- ✅ Header shows: "Test Americana"
- ✅ Tab bar visible: Standings | Jornadas | Crown | Members | Activity
- ⚠️ **SAVE THE LIGA ID**: Copy from URL, you'll need it for all other players

**Example**: If URL is `http://localhost:5173/liga/abc123def456`, save: `LIGA_ID = abc123def456`

### Step 1.3: Verify Admin is Only Member

1. Click **"👥 Miembros"** tab
2. Observe members list

**Expected Result**:
- ✅ Only 1 member shown: "Test Admin" (Admin badge)
- ✅ No other members yet

### Step 1.4: Verify Share Link Works

1. Click **"🔗"** button in header (top-right)
2. Dropdown menu appears
3. Click **"📋 COPIAR ENLACE"**

**Expected Result**:
- ✅ Toast notification: "✓ Enlace copiado"
- ✅ Toast auto-dismisses after 2 seconds
- ✅ Share link in clipboard: `http://localhost:5173/liga/<LIGA_ID>?invite=true`

---

## Phase 2: Players Joining (10 minutes)

### Step 2.1: Add 7 Players (Method A: Via Join Link)

**Switch to Window 2 (Incognito) - Non-Member User**

1. Open **new Incognito Window** (Cmd+Shift+N)
2. Navigate to: http://localhost:5173
3. Click "Login with Google"
4. Select: `test-player-1@example.com` (Jorge)
5. Onboarding: "Jorge"
6. Click "Guardar Perfil"

**Now join liga via link**:

1. Navigate to: `http://localhost:5173/liga/<LIGA_ID>?invite=true`
   - Replace `<LIGA_ID>` with the ID you saved in Step 1.2
2. **Invite Modal appears**:
   - Title: "Test Americana"
   - Description shown
   - Member count: "1 miembro"
   - Message: "Te invitaron a unirte a esta liga"
3. Click **"UNIRME"** button

**Expected Result**:
- ✅ Modal shows loading state briefly
- ✅ Modal closes
- ✅ Normal liga page displays (no modal)
- ✅ "👥 Miembros" tab shows 2 members now

### Step 2.2: Repeat for Players 2-8

**In same Incognito window**:

1. Logout: Click profile dropdown → "Cerrar Sesión"
2. Click "Login with Google"
3. Select next player: `test-player-2@example.com` (Maria)
4. Complete onboarding
5. Navigate to: `http://localhost:5173/liga/<LIGA_ID>?invite=true`
6. Click "UNIRME" in modal
7. **Repeat for remaining 6 players** (Carlos, Sofia, Diego, Ana, Miguel, Laura)

**Expected Result** (after each player joins):
- ✅ Invite modal appears for non-members
- ✅ Click UNIRME → join succeeds
- ✅ Player count increases (1, 2, 3, 4, 5, 6, 7, 8)

### Step 2.3: Verify All Members in Admin View

**Back in Window 1 (Admin user)**:

1. If still on liga page, click **F5** to refresh
2. Click **"👥 Miembros"** tab
3. Scroll through members list

**Expected Result**:
- ✅ 8 members shown:
  - Test Admin (Admin badge)
  - Jorge, Maria, Carlos, Sofia, Diego, Ana, Miguel, Laura (all with "Jugador" badge)
- ✅ Each name has green checkmark
- ✅ Admin can see "🗑️ Remover" button next to each player (for testing removal)

---

## Phase 3: Play Session - Check-in & Scoring (45 minutes)

### Step 3.1: Create Jornada (Play Session)

**In Window 1 (Admin user)**:

1. Click **"📅 Jornadas"** tab
2. Click **"+ NUEVA JORNADA"** button (only visible to admin)
3. Modal opens: "Nueva Jornada"
4. Date picker: Select **today's date** (March 21, 2026)
5. Click **"CREAR"** button

**Expected Result**:
- ✅ Modal briefly shows "Creando..." state
- ✅ Modal closes automatically
- ✅ Jornada appears in list:
  - Jornada #1
  - Date: Today (formatted as "21 de marzo de 2026")
  - Status: "Próxima" (upcoming)
  - Click to expand → shows "Abrir Check-in" button

### Step 3.2: Open Check-in

1. On the jornada card, click **"📝 ABRIR CHECK-IN"** button
2. Button state changes: "Abierto" with green badge

**Expected Result**:
- ✅ Check-in is now open
- ✅ Button shows "CERRAR CHECK-IN" (red) instead
- ✅ Modal might close, or you see check-in state

### Step 3.3: Players Check In (8 players)

**Scenario**: All 8 players are at the court. They open app on their phones/devices.

**For each player** (Jorge, Maria, Carlos, Sofia, Diego, Ana, Miguel, Laura):

1. **In separate browser window** (or new tab):
   - Navigate to http://localhost:5173
   - Login as that player account
   - Navigate to liga page (bookmark or direct URL)
2. **On Liga detail page**:
   - Should see jornada card with "CONFIRMAR ASISTENCIA" button
   - Click **"✓ CONFIRMAR ASISTENCIA"** button
3. **Expected**: Button changes to "✓ CONFIRMADO" (grayed out)

**Verification** (as admin):

1. Stay in Window 1 (as Test Admin)
2. Navigate to: `/liga/<LIGA_ID>/jornada/<JORNADA_ID>`
3. **Check-in counter** shows:
   - "8 de 8 confirmados" (8 of 8 confirmed) ✅
   - All 8 player names listed with green checkmarks

**OR** if counter not visible yet:

1. Refresh the page (F5)
2. Counter updates to show "8 de 8"

**Expected Result**:
- ✅ All 8 players show in check-in list
- ✅ Counter reads: "8 de 8 confirmados"
- ✅ All names have green checkmark or "Confirmado" badge

### Step 3.4: Generate Rounds

1. Admin sees check-in page with "8 de 8 confirmados"
2. Click **"🎲 GENERAR RONDAS"** button (visible once all checked in)

**Expected Result**:
- ✅ Page shows "Generando..." briefly
- ✅ Page updates with rounds list
- ✅ **7 rounds created** (for 8 players, americano format):
  - Round 1, Round 2, Round 3, Round 4, Round 5, Round 6, Round 7
  - Each round has:
    - Court numbers (1, 2, 3, 4)
    - Match details: Team A vs Team B
    - Score entry fields: `_ - _` (empty, ready for input)
    - 1 player on "Bye" (rest round)

**Verify Round Structure**:
- Round 1: 4 matches + 1 bye
- Round 2: 4 matches + 1 bye
- etc. (should have ~4 matches per round for 8 players)

### Step 3.5: Enter Scores - Round 1

1. **Round 1** is expanded and visible
2. For each match, click score fields and enter a score:

**Example Round 1 Scores** (be realistic):

| Court | Team A | Score | Team B | Winner Points |
|-------|--------|-------|--------|---|
| 1 | Jorge + Maria | 6 | Carlos + Sofia | 4 | Jorge, Maria: +3 pts each. Carlos, Sofia: 0 pts |
| 2 | Diego + Ana | 5 | Miguel + Laura | 6 | Miguel, Laura: +3 pts each. Diego, Ana: 0 pts |
| 3 | Player A + ? | 7 | ? | 5 | ... |
| 4 | ? | ... | ? | ... | ... |
| Bye | Player X | - | (resting) | - |

**How to enter scores**:
1. Click on score field (shows `_`)
2. Type number (0-9)
3. Press Tab or click next field
4. Repeat for all matches in round 1

**Expected Result**:
- ✅ All 4 matches in Round 1 have scores entered
- ✅ 1 player on "Bye" (no match)
- ✅ After entering last score, Round 2 might auto-generate or show "Siguiente Ronda" button

### Step 3.6: Complete Rounds 2-7

**Repeat the same process for Rounds 2-7**:

1. Enter scores for all 4 matches in round 2
2. Refresh page if needed to see Round 2 appear
3. Repeat for Rounds 3, 4, 5, 6, 7

**Scoring Tips** (keep realistic):
- Typical wins: 6-4, 6-5, 7-5, 7-6 (winning team gets 3 points)
- Some ties: 6-6 (both teams get 1 point)
- Occasional blowouts: 7-3, 7-2 (still 3 points for winner)

**After each round**: Points accumulate
- By Round 7, look at running totals
- Some players will have 15+ points

**Expected Result**:
- ✅ All 7 rounds completed with scores
- ✅ No missing scores
- ✅ Running point totals visible (or calculated after final round)

### Step 3.7: Verify Standings During Rounds

**After Round 3 or 4**, while still entering scores:

1. Click **"🏆 STANDINGS"** tab (or check standings column if visible)
2. Verify running totals:
   - Players with more wins show higher points
   - Format: `Name - XX pts` or similar

**Expected Result**:
- ✅ Standings update as scores are entered
- ✅ Top scorers are visible
- ✅ Player with most wins is leading

---

## Phase 4: Finalization & Results (30 minutes)

### Step 4.1: Finalize Jornada

**After all 7 rounds completed and scored**:

1. Scroll to bottom of jornada detail page
2. Look for **"✅ FINALIZAR JORNADA"** button (red or prominent color)
3. Click button

**Expected Result**:
- ✅ Button shows "Finalizando..." state
- ✅ Page refreshes or shows confirmation
- ✅ Status changes from "En Juego" to "Completada" (Completed)

### Step 4.2: Verify Crown Transfer & Celebration (if applicable)

**After finalization**:

1. Check if **crown transferred**:
   - If new player is now #1, crown should transfer
   - Look for **crown celebration animation**:
     - Overlay with trophy icon
     - "🎉 ¡Nuevo Campeón!" message
     - Confetti animation (if enabled)
     - Auto-dismisses after 3-5 seconds

2. If **same player remained #1**:
   - Celebration might not show (no transfer needed)
   - But status should be "Completada"

**Expected Result**:
- ✅ Crown celebration appears (if crown transferred)
- ✅ Animation displays for 3-5 seconds
- ✅ User can click to dismiss early
- ✅ After dismiss, normal page displays

### Step 4.3: Check Jornada History

1. Navigate to **"📅 JORNADAS"** tab
2. Scroll to find today's jornada

**Expected Result**:
- ✅ Jornada shows in list with status "Completada"
- ✅ Shows date, jornada number, and standings preview
- ✅ Click to expand and see final results

### Step 4.4: View Detailed Jornada Results

1. Click on the completed jornada card
2. Page opens: **"Resultados de la Jornada"** or similar

**Expected Result**:
- ✅ Page shows all 7 rounds
- ✅ Each round shows all 4 matches with final scores
- ✅ Bye player indicated
- ✅ Final standings at bottom:
  - Ranked 1-8 by points
  - Top player has crown icon 👑
  - Points totals visible (15-21 points typically for 7 rounds)

### Step 4.5: Check Updated Leaderboard

1. Navigate to **"🏆 STANDINGS"** tab (in main liga view, not jornada detail)
2. View current season standings

**Expected Result**:
- ✅ All 8 players listed
- ✅ Points updated from today's jornada:
  - Examples: "Test Admin - 18 pts", "Jorge - 15 pts", etc.
- ✅ Top player (#1) has 👑 crown icon
- ✅ Ranking reflects today's play

### Step 4.6: Check Activity Feed

1. Navigate to **"📢 ACTIVIDAD"** tab
2. Scroll through feed

**Expected Result** (you should see events in reverse chronological order):
- ✅ Event: "Jornada #1 completada" or "Jornada finalizada"
- ✅ Event: "Crown transferred" (if applicable) - e.g., "Test Admin is now the champion! 👑"
- ✅ Timestamp: Today's date and time
- ✅ Player avatars/names visible
- ✅ Icons and colors match activity type

### Step 4.7: Test Share Link as Non-Member

**Window 2 (Incognito) - Non-member user**:

1. Logout all players
2. Clear cookies/cache for localhost
3. Do NOT login to any account
4. Navigate to: `http://localhost:5173/liga/<LIGA_ID>?invite=true`

**Expected Result**:
- ✅ Invite modal appears (even though anonymous)
- ✅ Shows liga name "Test Americana"
- ✅ Shows description and member count "8 miembros"
- ✅ Two buttons: "DESCARTAR" and "UNIRME"
- ✅ Can click "UNIRME" (will prompt login)

**OR** if already logged in as non-member (like "Non-member" account):

1. Navigate to share link
2. Invite modal appears
3. Click "UNIRME"
4. Join succeeds
5. Now has 9 members (was 8, now 9)

**Expected Result**:
- ✅ Non-member can see liga
- ✅ Can join via invite link
- ✅ Appears in members list immediately

### Step 4.8: Verify Database Integrity

**In browser console** (F12 → Console tab):

```javascript
// Check current user
const { data: { user } } = await supabase.auth.getUser()
console.log('User ID:', user.id)

// Check liga exists and has 8 members
const { data: liga } = await supabase
  .from('ligas')
  .select('*, liga_members(count)')
  .eq('id', '<LIGA_ID>')
  .single()
console.log('Liga members:', liga.liga_members.count)

// Check jornada was finalized
const { data: jornada } = await supabase
  .from('jornadas')
  .select('*')
  .eq('liga_id', '<LIGA_ID>')
  .eq('jornada_number', 1)
  .single()
console.log('Jornada status:', jornada.status) // Should be 'completed' or similar

// Check all rounds exist
const { data: rounds } = await supabase
  .from('americano_rounds')
  .select('*')
  .eq('jornada_id', jornada.id)
  .order('round_number')
console.log('Rounds:', rounds.length) // Should be 7

// Check matches scored
const { data: matches } = await supabase
  .from('americano_matches')
  .select('*')
  .eq('jornada_id', jornada.id)
console.log('Matches:', matches.length) // Should be ~28 (7 rounds × 4 matches)
console.log('Matches with scores:', matches.filter(m => m.team_a_score !== null).length)
```

**Expected Results**:
- ✅ User ID is valid
- ✅ Liga member count = 8
- ✅ Jornada status is "completed"
- ✅ Rounds count = 7
- ✅ Matches count = ~28 (or close)
- ✅ All matches have scores (not null)

---

## Success Criteria Checklist

### ✅ Phase 1: Liga Setup
- [ ] Liga "Test Americana" created successfully
- [ ] Admin (Test Admin) is creator
- [ ] Share link copies to clipboard
- [ ] Liga ID recorded and accessible

### ✅ Phase 2: Players Joining
- [ ] 8 players join via invite link
- [ ] Invite modal shows for non-members
- [ ] All 8 players visible in members list
- [ ] Member count shows: "8 miembros"

### ✅ Phase 3: Check-in & Scoring
- [ ] Check-in opened for jornada
- [ ] All 8 players checked in successfully
- [ ] Counter shows "8 de 8 confirmados"
- [ ] 7 rounds generated (not 6, not 8)
- [ ] Each round has 4 matches + 1 bye player
- [ ] Scores entered for all 28 matches (7 rounds × 4)
- [ ] Running standings update correctly
- [ ] No scoring errors (red highlights, RLS blocks)

### ✅ Phase 4: Finalization & Results
- [ ] Jornada finalized without errors
- [ ] Crown celebration overlay appears (if applicable)
- [ ] Jornada appears in history with "Completada" status
- [ ] Detailed results viewable (all rounds, all matches)
- [ ] Standings updated (points reflect play)
- [ ] Crown icon next to #1 player
- [ ] Activity feed shows jornada completion event
- [ ] Activity feed shows crown transfer event (if applicable)
- [ ] Non-members can view liga via share link
- [ ] Database integrity verified (rounds, matches, scores all saved)

### ✅ No Console Errors
- [ ] No red errors in DevTools console
- [ ] No "403 Forbidden" or "RLS violation" messages
- [ ] No "Network Error" messages
- [ ] No "undefined" crashes

---

## Troubleshooting Guide

### Issue: "UNIRME A LIGA" button not showing when clicking invite link

**Cause**: User is already a member (browser cache)

**Fix**:
1. Clear browser cookies: Settings → Clear browsing data
2. Open new Incognito window
3. Try invite link again

---

### Issue: Check-in doesn't count player (counter stuck at 7/8)

**Cause**: Realtime subscription not syncing, or RLS policy blocking

**Check**:
1. Player refreshed page after check-in? (should auto-update, but F5 helps)
2. Admin refreshes jornada detail page
3. Check DevTools Network tab for "jornada_checkins" POST request
   - Should see 200 status (success)
   - If 403, RLS is blocking

**Fix**:
1. Verify player is in `liga_members` table (check Supabase project)
2. Verify RLS policy on `jornada_checkins` allows authenticated users to insert their own record
3. Player tries check-in again

---

### Issue: "GENERAR RONDAS" button doesn't appear or fails

**Cause**: Not all 8 players checked in, OR admin hasn't refreshed page

**Check**:
1. Admin refreshes page (F5)
2. Counter shows "8 de 8 confirmados"?
   - If not, another player hasn't checked in yet

**Fix**:
1. Double-check all 8 players have clicked "CONFIRMAR ASISTENCIA"
2. Admin waits a moment, then refreshes
3. Try "GENERAR RONDAS" again

---

### Issue: Rounds generated but show 6 rounds instead of 7

**Cause**: Americano algorithm issue, or one player not included

**Fix**:
1. Check that exactly 8 players checked in (not 7 or 9)
2. With 8 players, should generate 7 rounds
3. If 7 players: 6 rounds (correct)
4. If 9 players: 8 rounds (correct)
5. Verify database: Run SQL query in Supabase project:
   ```sql
   SELECT COUNT(*) FROM jornada_checkins
   WHERE jornada_id = '<JORNADA_ID>';
   ```
   Should return 8.

---

### Issue: Scores not saving (enter score, refreshes back to blank)

**Cause**: RLS policy blocking admin from updating matches, OR network error

**Check**:
1. DevTools Network tab: Look for PATCH request to `americano_matches`
   - If 403: RLS is blocking
   - If 5xx: Server error

**Fix**:
1. Verify admin role in `liga_members` table (role = 'admin')
2. Try entering score again
3. If still fails, check RLS policy:
   - Admin should have UPDATE permission on `americano_matches`
   - For own liga only

---

### Issue: Crown celebration doesn't appear after finalization

**Cause**: Crown didn't actually transfer (same player was #1 before and after)

**Verify**:
1. Check jornada results: Who was #1 in previous jornada? Who is #1 now?
2. If same: No celebration (correct behavior)
3. If different: Should have celebration

**Fix**:
- If different and no animation: Check browser console for errors
- Celebration uses Framer Motion, ensure animations enabled

---

### Issue: Activity feed shows no events or "no data"

**Cause**: Events not created in activity table, OR queries not working

**Check**:
1. Refresh page (F5)
2. Scroll through activity feed
3. Check Supabase project:
   ```sql
   SELECT * FROM activity_logs
   WHERE liga_id = '<LIGA_ID>'
   ORDER BY created_at DESC
   LIMIT 10;
   ```
   - Should show events for jornada completion, crown transfer, etc.

**Fix**:
1. If no events in DB: Activity logging might not be implemented yet
2. This is optional for Task 20 (nice-to-have, not required)

---

### Issue: Database integrity check shows mismatched counts

**Example**: Console query shows 5 rounds but page shows 7

**Cause**: Data not fully saved, OR stale cache

**Fix**:
1. Refresh page and recount
2. Check browser Network tab for any failed requests
3. If persistent, check Supabase logs for errors

---

## Code References (for debugging)

| Component | Path | Purpose |
|-----------|------|---------|
| Jornada Detail | `/src/pages/LigaJornadaDetail.jsx` | Shows rounds, matches, standings |
| Check-in | `/src/pages/JornadaRouter.jsx` | Check-in UI and logic |
| Rounds Generation | `/src/utils/americanoEngine.js` | Calculates rounds and matches |
| Scoring | `/src/components/Liga/MatchScoreInput.jsx` | Score entry fields |
| Activity Feed | `/src/pages/LigaActivity.jsx` | Shows events |
| Leaderboard | `/src/pages/LigaDetail.jsx` | Standings tab |
| Crown Logic | `/src/stores/ligaStore.js` | Crown transfer calculation |

---

## Manual Commands for Testing

### Check current user (admin or player)

```javascript
// In browser console:
const { data: { user } } = await supabase.auth.getUser()
console.log('User:', user.email, user.id)
```

### List all liga members

```javascript
const { data: members } = await supabase
  .from('liga_members')
  .select('player_id, role, profiles(display_name)')
  .eq('liga_id', '<LIGA_ID>')
  .order('role')
console.log('Members:', members)
```

### View jornada rounds and matches

```javascript
const { data: rounds } = await supabase
  .from('americano_rounds')
  .select('*, americano_matches(team_a_score, team_b_score)')
  .eq('jornada_id', '<JORNADA_ID>')
  .order('round_number')
console.log('Rounds:', rounds)
```

### Reset for re-testing (delete test jornada)

```javascript
// Delete specific jornada (and cascading data)
const { error } = await supabase
  .from('jornadas')
  .delete()
  .eq('id', '<JORNADA_ID>')
if (error) console.error('Delete failed:', error)
else console.log('Jornada deleted')
```

---

## Recommendations for Monday Play (March 24)

### Before the real session:

1. **Run this E2E test** on Friday/Saturday (this document)
2. **Record any issues** in the Troubleshooting Guide above
3. **Fix critical bugs** (anything blocking flow)
4. **Non-critical bugs** (styling, animations) can be deferred

### Day-of (Monday):

1. Have **2 admin users** available:
   - Test Admin (main admin)
   - Backup admin (in case network issues)
2. **Download app on all 8 players' phones** before play starts
3. Have **WiFi password** ready (for team's wifi)
4. Do a **quick smoke test** 15 minutes before play:
   - Jornada loads
   - Check-in button visible
   - No console errors
5. **Backup: spreadsheet** (in case app fails, manually record scores)

### During play:

1. Have admin check in players as they arrive
2. Generate rounds once all 8 present
3. Keep phone charged + nearby during matches
4. Enter scores after each match (don't wait until end)
5. If something breaks, refer to this guide's Troubleshooting section

---

## Test Report Template

After completing all 4 phases, fill in this report:

```
TEST EXECUTION REPORT
=====================

Date: March 21/22, 2026
Tester: [Your Name]
Duration: [X minutes]

RESULTS:

Phase 1 - Liga Setup: ✅ PASS / ⚠️ PARTIAL / ❌ FAIL
- Notes: [Any issues?]

Phase 2 - Players Joining: ✅ PASS / ⚠️ PARTIAL / ❌ FAIL
- Notes: [Any issues?]

Phase 3 - Check-in & Scoring: ✅ PASS / ⚠️ PARTIAL / ❌ FAIL
- Notes: [Any issues?]

Phase 4 - Finalization & Results: ✅ PASS / ⚠️ PARTIAL / ❌ FAIL
- Notes: [Any issues?]

OVERALL RESULT: ✅ READY / ⚠️ READY_WITH_CONCERNS / ❌ BLOCKED

Critical Issues Found:
1. [Issue 1]
2. [Issue 2]

Non-Critical Issues Found:
1. [Issue 1]
2. [Issue 2]

Console Errors:
[Paste any red errors from DevTools]

Database Integrity:
- Liga members: 8 ✅
- Jornada status: Completed ✅
- Rounds created: 7 ✅
- Matches scored: 28/28 ✅

Readiness for Monday: [YES / NO / WITH_CONCERNS]

Additional Notes:
[Any observations or suggestions]
```

---

## Next Steps (Post-Test)

1. ✅ **If all tests pass**: Ready for Monday play
2. ⚠️ **If partial passes**: Fix non-critical issues, test again
3. ❌ **If tests fail**: Debug per Troubleshooting Guide, file GitHub issues if needed

---

**Document Version**: 1.0
**Last Updated**: March 21, 2026
**Status**: Ready for testing
