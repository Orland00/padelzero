# Agent Topology

Public shell for AI-assisted product and operations agents.

| Agent | Responsibility | Output |
|-------|----------------|--------|
| Match Recap Agent | Converts score context into shareable summaries | Recap draft |
| Coach CRM Agent | Summarizes authorized notes and follow-ups | Coach digest |
| Club Ops Agent | Reviews booking and occupancy aggregates | Ops summary |
| WhatsApp Router Agent | Classifies group messages into safe tool intents | Tool intent |
| Security Review Agent | Reviews RLS, auth, and migration changes | Findings |
| QA Generation Agent | Produces focused test ideas for domain flows | Test plan |

## Rules

- Agents only see scoped, authorized data.
- Write actions require explicit user intent.
- Admin data is never exposed through assistant responses.
- Private notes remain private to their owning coach or club context.
