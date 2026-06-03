# AI Operations

PadelZero includes the public shell for several AI-assisted product surfaces.
The real provider configuration, runtime prompts, and private user data are not
present in this snapshot.

## AI Surface

- Match recap assistant: turns scores and context into shareable summaries.
- Coach CRM assistant: helps summarize training notes and follow-ups.
- Club ops assistant: summarizes booking and occupancy patterns for operators.
- WhatsApp agent shell: routes group messages into safe tool calls.
- QA agents: generate and review tests for security, RLS, and tournament logic.

## Guardrails

- AI never receives service-role keys.
- AI never bypasses Row Level Security.
- Tool calls are scoped by user, club, or league context.
- Generated messages are treated as drafts unless the route explicitly allows
  transactional responses.
- Prompts avoid raw phone numbers, emails, payment data, and private notes unless
  the current user is authorized to see them.

## Evaluation Areas

- Correctness: score math, ELO changes, bracket integrity.
- Safety: no PII leakage, no admin-only data in user responses.
- Tone: Spanish-first, short, useful, no fake certainty.
- Tool discipline: every write action must have an explicit user intent.
