# PadelZero

**A hyperlocal padel community platform.** Spanish-first, mobile-first, offline-ready PWA for recording matches, tracking ELO, and running leagues and tournaments.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3FCF8E?logo=supabase&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-Offline_Ready-5A0FC8?logo=pwa&logoColor=white)

> This is a **public, sanitized snapshot** of the PadelZero codebase, shared to demonstrate engineering approach and architecture. All secrets, credentials, and private/business data have been removed. It is not configured to connect to any live environment.

---

## What is PadelZero?

PadelZero replaces the scattered WhatsApp groups and paper scoresheets that most padel communities rely on with a unified platform for recording matches, tracking ELO ratings, running leagues and tournaments, and building a local community. It is a progressive web app: installable, mobile-first, and works offline with a background sync queue.

## Features

### Core
- **Match recording** — 1v1 / 2v2 with live scoring and multiple set formats
- **ELO rankings** — K-factor rating system with tier badges and multiple leaderboards
- **Player profiles** — stats, match history, ELO charts, head-to-head, pair chemistry
- **Auth** — email and Google OAuth with auto-profile creation

### Leagues & tournaments
- **Liga system** — standings, jornada scheduling, crown transfers, activity feeds
- **Americano / Mexicano** — round-robin formats with check-in and auto round generation
- **Tournament brackets** — single elimination and group-stage formats
- **Dual-ELO league mode** — tracks individual and team ratings together

### Social & gamification
- Community feed, friend requests, shareable result cards, badges, rival finder, QR profile sharing

### Platform
- Club directory and court booking sheets, coach profiles, sponsor placements, ELO calculator, CSV export, i18n (ES/EN), full PWA support

### AI ops
- Public AI operations shell under `docs/ai/`: prompt registry, eval cases,
  model-routing policy, and guardrails for assistants, WhatsApp tooling, coach
  notes, and security reviews.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS |
| State | Zustand |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions) |
| Hosting | Cloudflare Pages |
| Testing | Vitest + Playwright |

## Architecture highlights

- **Row Level Security everywhere.** Business logic that needs elevated trust runs in Postgres RPCs and Supabase Edge Functions, not the client. See `supabase/migrations/` for the full security model evolution.
- **Offline-first PWA.** Match writes queue locally and sync in the background via the service worker (`src/sw.js`).
- **Tested security posture.** `Test/tests/security/` contains IDOR, RLS, and access-control tests run against the schema.

## Project layout

```
src/                  React app (components, pages, hooks, stores, lib, utils)
supabase/
  schema.sql          base schema
  migrations/         versioned migrations (incl. the RLS/security hardening trail)
  functions/          Supabase Edge Functions
Test/                 unit, frontend, security, e2e, and stress tests
scripts/              build, smoke-test, and security-check tooling
```

## Running locally

```bash
npm install
cp .env.example .env      # fill in your own Supabase project values
npm run dev
```

Tests:

```bash
npm test                  # unit (vitest)
npm run test:e2e          # end-to-end (playwright)
```

## Note on data & secrets

This snapshot ships **no credentials and no production data**. `.env.example` lists the variable names only. You must point it at your own Supabase project to run it.

## License

Source-available for portfolio / review purposes. Not licensed for redistribution or commercial reuse.
