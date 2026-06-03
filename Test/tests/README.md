# PadelZero test suite

## Layout

```
tests/
├── frontend/          # vitest — runs on `npm test`
│   ├── eloEngine.test.js           ELO math (K-factor, floor 800, doubles avg)
│   ├── americanoEngine.test.js     round-robin rotation (circle method)
│   ├── scoreValidation.test.js     padel score rules
│   ├── bookingClient.test.js       booking error translation + display helpers + overlap math
│   ├── notificationSender.test.js  sender-display contract for Header notification panel
│   └── ligaTournamentFlows.test.js liga invite gates, points accounting, tournament capacity
├── sql/               # integration scripts — paste into Supabase SQL Editor
│   ├── booking_integration.sql     full booking lifecycle (book, past/future/overlap/cancel/rate-limit)
│   └── rls_policies.sql            (pre-existing) RLS policy probes
└── security/          # adversarial-check scripts
```

## What's covered by automated vitest

| Feature | Coverage source |
|---|---|
| ELO calculation (K=40/32, floor 800, doubles) | `eloEngine.test.js` |
| Americano round generation | `americanoEngine.test.js` |
| Score validation (padel rules) | `scoreValidation.test.js` |
| Booking error → Spanish toast mapping | `bookingClient.test.js` |
| Booking display helpers (time/price) | `bookingClient.test.js` |
| Slot-overlap math (mirrors DB tsrange) | `bookingClient.test.js` |
| Notification sender-display branches | `notificationSender.test.js` |
| Liga invite acceptance gates | `ligaTournamentFlows.test.js` |
| Liga points accounting (win/draw/loss) | `ligaTournamentFlows.test.js` |
| Tournament capacity gating | `ligaTournamentFlows.test.js` |
| ELO delta sign invariants | `ligaTournamentFlows.test.js` |

## What's covered by SQL integration

| Feature | Script |
|---|---|
| `create_booking` RPC happy path | `sql/booking_integration.sql` |
| Past-date guard | `sql/booking_integration.sql` |
| 14-day forward window | `sql/booking_integration.sql` |
| `EXCLUDE USING gist` overlap prevention | `sql/booking_integration.sql` |
| Cancel flow (RLS + slot release) | `sql/booking_integration.sql` |
| Re-book after cancel | `sql/booking_integration.sql` |
| 5/hour rate limit | `sql/booking_integration.sql` |
| Admin owner-view of all bookings | `sql/booking_integration.sql` (final SELECT) |

## What's NOT covered (manual QA)

- Real OAuth/email sign-up (requires Google console or email deliverability)
- Stripe checkout redirect (requires live Stripe keys — skipped per current scope)
- Web push notification delivery (skipped per current scope)
- Visual layout / Lighthouse (checked manually after deploy)

## Running

```bash
npm test              # vitest frontend suite
npm run test:watch    # watch mode
npm run test:smoke    # scripts/smoke-test.js

# SQL integration:
# 1. Ensure test data is seeded (Club Test Demo City Norte, testagent_* profiles)
# 2. Open Supabase SQL Editor
# 3. Paste tests/sql/booking_integration.sql and run
# 4. Inspect NOTICES for [PASS] / [FAIL] lines
```

## Cleanup

`scripts/test-data-cleanup.sql` removes all seeded test data (profiles, ligas,
tournament, clubs, courts, coaches) in one transaction.
