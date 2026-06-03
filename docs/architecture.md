# Architecture Shell

This public snapshot shows the production-style shape of the platform without
publishing private data, real identifiers, credentials, or live operational
configuration.

## Runtime Components

| Area | Shell |
|------|-------|
| Client | React + Vite PWA |
| Database | Supabase Postgres with RLS and RPC-backed domain logic |
| Auth | Supabase Auth with profile repair and onboarding flows |
| Storage | Supabase Storage for profile, club, and banner assets |
| Edge Functions | Booking checkout, webhooks, match finalization, messaging agents |
| Payments | Stripe checkout/webhook boundary |
| Messaging | WhatsApp/Meta webhook and notification surfaces |
| Push | Web Push subscription and delivery functions |
| Maps | Location search and court discovery boundary |
| AI | Assistants for summaries, operations digests, routing, and QA review |

## Data Flow

1. Users authenticate and load profile state through RLS-safe queries.
2. Matches, leagues, tournaments, clubs, and bookings write through stores,
   RPCs, or edge functions depending on trust level.
3. Offline actions queue locally and reconcile when connectivity returns.
4. Edge functions handle privileged API boundaries such as payments, webhooks,
   push delivery, and agent-style messaging.
5. AI features operate on scoped, authorized context and produce drafts,
   summaries, or tool intents.
6. Security checks and migration gates keep risky database changes explicit.

## Integration Boundaries

- Supabase is the source of truth.
- Stripe and Meta/WhatsApp integrations live behind edge functions.
- Client code never ships server-side secrets.
- RLS protects user, club, league, and coach data.
- AI tools must respect the same authorization boundaries as regular UI flows.

## Removed From Public Snapshot

- Live project IDs and credentials.
- Real admin, league, user, and club identifiers.
- Private prompts and provider configuration.
- Private business metrics and operational data.
