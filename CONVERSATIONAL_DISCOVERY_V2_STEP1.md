# Conversational Discovery v2 — Step 1

This delivery implements the standalone domain contract for the governed conversational interview. It does not add UI, database tables, RPCs, or runtime integration.

## Included

- Objective evidence criteria for thirteen discovery dimensions.
- Knowledge classification and uncertainty downgrade rules.
- Deterministic artifact readiness for eight technical artifacts.
- Governed completion assessment.
- Question-priority scoring.
- Soft and hard turn-limit behavior.
- Zod contract for `discovery.v2` structured output.
- Versioned prompt builder.
- Automated domain and schema tests.

## Not included yet

- Agent registry integration.
- OpenAI runtime execution.
- Supabase migration `0015`.
- Chat UI.
- Persistence and review RPCs.
- Project Model ingestion.

This step is intentionally isolated so the contract can be validated before database and UI work begins.
