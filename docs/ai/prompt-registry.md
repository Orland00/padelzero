# Prompt Registry

Public prompt shells only. Runtime prompts are assembled from authorized data at
request time.

| Prompt | Purpose | Data Boundary |
|--------|---------|---------------|
| `match.recap.v1` | Generate a short match recap | Match participants and final score |
| `coach.note-summary.v1` | Summarize coach notes | Coach-owned student notes only |
| `club.ops-digest.v1` | Summarize bookings and utilization | Club-owned booking aggregates |
| `whatsapp.intent-router.v1` | Classify user intent into tools | Message text and linked context |
| `qa.security-review.v1` | Review RLS and auth changes | Migration diff and tests |

## Model Routing

- Intent routing uses fast, low-cost models.
- Summaries use deterministic settings.
- Ambiguous booking or scoring requests require a clarification step.
- Sensitive writes require explicit user confirmation before tool execution.
