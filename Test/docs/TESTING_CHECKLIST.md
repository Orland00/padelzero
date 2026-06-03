# Quick Testing Checklist for Monday (March 24)

**Time**: ~10 minutes before play session
**Purpose**: Quick smoke test to ensure app is working before real play

---

## Pre-Play Checklist (15 minutes before)

### ✅ Dev Server Running
```
npm run dev
→ Should see: "VITE v5.x.x ready in XXX ms"
→ Browser: http://localhost:5173 loads without errors
```

### ✅ Login & Load Liga
- [ ] Login as admin (Test Admin)
- [ ] Navigate to Test Liga
- [ ] Page loads, tabs visible (Standings, Jornadas, Crown, Members, Activity)

### ✅ Create Jornada (if not already done)
- [ ] Click "📅 Jornadas" tab
- [ ] Click "+ NUEVA JORNADA"
- [ ] Select today's date
- [ ] Click "CREAR"
- [ ] Jornada appears with "ABRIR CHECK-IN" button

### ✅ Check-in Ready
- [ ] Click "📝 ABRIR CHECK-IN" on jornada
- [ ] Button changes to "CERRAR CHECK-IN"
- [ ] First player checks in, counter updates (1/8)

### ✅ No Console Errors
- [ ] Press F12 (DevTools)
- [ ] Click Console tab
- [ ] **NO RED ERRORS** (blue info logs OK)
- [ ] Close DevTools

---

## During Play Checklist

### ✅ Check-in Phase
```
All 8 players arrive:
- [ ] Player 1 checks in (counter: 1/8)
- [ ] Player 2 checks in (counter: 2/8)
- [ ] Player 3 checks in (counter: 3/8)
- [ ] Player 4 checks in (counter: 4/8)
- [ ] Player 5 checks in (counter: 5/8)
- [ ] Player 6 checks in (counter: 6/8)
- [ ] Player 7 checks in (counter: 7/8)
- [ ] Player 8 checks in (counter: 8/8)

Expected: "8 de 8 confirmados" ✅
```

### ✅ Generate Rounds
```
Once all checked in:
- [ ] Click "🎲 GENERAR RONDAS"
- [ ] Page shows "Generando..."
- [ ] 7 rounds appear (for 8 players)
- [ ] Each round has 4 matches + 1 bye
```

### ✅ Round 1 Scoring
```
After matches complete:
- [ ] Admin opens Round 1
- [ ] Enters all 4 match scores
- [ ] No "Network Error" messages
- [ ] Scores stick (don't revert when refreshed)
```

### ✅ Rounds 2-7 Scoring
```
For each subsequent round:
- [ ] Scores entered after matches
- [ ] Running standings update (visible in Standings tab)
- [ ] No scoring errors
```

### ✅ Finalize Jornada
```
After Round 7 complete:
- [ ] Scroll to bottom
- [ ] Click "✅ FINALIZAR JORNADA"
- [ ] Wait for "Finalizando..." to complete
- [ ] Crown celebration appears (if crown transferred)
- [ ] Status changes to "Completada"
```

### ✅ Verify Results
```
After finalization:
- [ ] Click "📅 JORNADAS" tab
- [ ] See today's jornada with "Completada" status
- [ ] Click to expand → see final results
- [ ] Click "🏆 STANDINGS" → see updated leaderboard
- [ ] Top player has crown icon 👑
- [ ] Points total correct (sum of wins × 3)
```

---

## Rollback Plan (If Something Breaks)

### Can't Create Jornada
1. Check: Admin role confirmed?
2. Check: Liga exists and accessible?
3. **Fix**: Logout, login again, try again
4. **Fallback**: Use manual spreadsheet to track scores

### Rounds won't generate
1. Check: All 8 players confirmed (counter shows 8/8)?
2. Refresh page (F5)
3. **Fix**: Try "GENERAR RONDAS" again
4. **Fallback**: Manually create rounds (if feature available)

### Scores won't save
1. Check: Network tab shows failed requests? (DevTools)
2. Refresh page (F5)
3. **Fix**: Try entering score again (different player?)
4. **Fallback**: Use spreadsheet to record all scores, enter after play

### App crashes / white screen
1. Refresh page (F5)
2. Logout, login again
3. **Fallback**: Use browser back button, try again
4. **Emergency**: Switch to backup admin or spreadsheet

### No internet / Network down
1. Try reloading page
2. If persistent offline:
   - **Use backup**: Offline mode (if available)
   - **Manual**: Record scores in spreadsheet, enter later

---

## Scoring Reference

| Match Result | Winning Team Gets | Losing Team Gets | Example |
|---|---|---|---|
| Win (any score) | 3 points | 0 points | 6-4, 7-5, 7-2 |
| Tie | 1 point | 1 point | 6-6 |

**7 Rounds × 4 Matches = 28 matches**
- **Max points per player**: 28 (win every match × 3 pts, but impossible in americano)
- **Typical range**: 12-21 points (3-7 match wins)
- **Minimum**: 0 points (0 match wins)

---

## Backup (Paper) Score Sheet

If app fails during play, fill this out and enter later:

```
LIGA: Test Americana
DATE: March 24, 2026
PLAYERS: Jorge, Maria, Carlos, Sofia, Diego, Ana, Miguel, Laura

ROUND 1
--------
Court 1: Jorge + Maria _____ vs Carlos + Sofia _____
Court 2: Diego + Ana _____ vs Miguel + Laura _____
Court 3: Player A + ? _____ vs ? + ? _____
Court 4: ? + ? _____ vs ? + ? _____
Bye: [Player name]

[Repeat for Rounds 2-7]

FINAL STANDINGS (after all rounds):
1. [Name] - __ points
2. [Name] - __ points
3. [Name] - __ points
4. [Name] - __ points
5. [Name] - __ points
6. [Name] - __ points
7. [Name] - __ points
8. [Name] - __ points
```

---

## Success = Green Light for Next Week

After jornada completes successfully:
- ✅ All players have scores recorded
- ✅ Final standings show #1 player with crown
- ✅ No major errors or crashes
- ✅ Time to play (not stuck on admin work)

**Status**: 🟢 Ready to schedule future play sessions!

---

**Last Updated**: March 21, 2026
**Next Review**: After Monday March 24 play session
