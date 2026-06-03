import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoFile = (path) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('security hardening guards', () => {
  it('does not runtime-cache Supabase profiles in the service worker', () => {
    const sw = repoFile('src/sw.js')

    expect(sw).not.toContain('supabase-profile-cache')
    expect(sw).not.toContain('StaleWhileRevalidate')
    expect(sw).toContain("!url.pathname.includes('/rest/v1/profiles')")
  })

  it('keeps theme bootstrapping out of inline HTML scripts', () => {
    const html = repoFile('index.html')

    expect(html).not.toContain('padelzero_theme')
    expect(html).not.toContain('Prevent flash')
    expect(html).toContain('<script type="module" src="/src/main.jsx"></script>')
  })

  it('only expires pending_payment bookings from Stripe expired webhooks', () => {
    const webhook = repoFile('supabase/functions/booking-webhook/index.ts')

    expect(webhook).toContain('event.type === "checkout.session.expired"')
    expect(webhook).toContain('.eq("status", "pending_payment")')
  })

  it('keeps booking checkout updates scoped to the authenticated owner', () => {
    const checkout = repoFile('supabase/functions/booking-checkout/index.ts')

    expect(checkout).toContain('.eq("booked_by", user.id)')
    expect(checkout).toContain('.in("status", ["confirmed", "pending_payment"])')
  })

  it('fails closed on unsigned WhatsApp webhooks', () => {
    const webhook = repoFile('supabase/functions/whatsapp-webhook/index.ts')

    expect(webhook).toContain('META_APP_SECRET not set')
    expect(webhook).toContain('return new Response("Server misconfiguration", { status: 500 })')
    expect(webhook).toContain('return new Response("Invalid signature", { status: 401 })')
  })

  it('requires internal service-role authorization before running the WhatsApp agent', () => {
    const agent = repoFile('supabase/functions/whatsapp-agent/index.ts')

    expect(agent).toContain('req.headers.get("Authorization") !== `Bearer ${serviceRoleKey}`')
    expect(agent).toContain('return new Response("Unauthorized", { status: 401 })')
  })

  it('uses match-scoped ELO idempotency for tournament match completion', () => {
    const finishTournamentMatch = repoFile('supabase/functions/finish-tournament-match/index.ts')

    expect(finishTournamentMatch).toContain('match.tournament_id !== tournament_id')
    expect(finishTournamentMatch).toContain('Winner team does not belong to this match')
    expect(finishTournamentMatch).toContain('.eq("source_id", match_id)')
    expect(finishTournamentMatch).toContain('already_processed')
    expect(finishTournamentMatch).toContain('source_id: match_id')
    expect(finishTournamentMatch).not.toContain('if (match.status === "finished")')
  })
})
