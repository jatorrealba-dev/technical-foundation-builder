# Readiness Dashboard v7

## Scope

Version 7 turns the existing Readiness Assessor into a persistent, reviewable product capability. It combines a deterministic evidence engine with optional AI assessments and preserves immutable historical snapshots.

## Routes

```text
/projects/[projectId]/readiness
/projects/[projectId]/readiness/assessments/[assessmentId]
```

## Eight dimensions

Every assessment contains exactly one score for each dimension:

- product;
- domain;
- architecture;
- data;
- security;
- testing;
- delivery;
- operations.

Scores range from 0 to 100 and are mapped to:

```text
0–39   not_ready
40–59  at_risk
60–74  progressing
75–89  ready_for_review
90–100 ready
```

A critical blocker caps the deterministic overall score at 49. A high blocker caps it at 69. This prevents a strong average from hiding a severe unresolved dependency.

## Deterministic assessment

The deterministic engine does not call OpenAI. It evaluates persisted evidence from:

- interview completion;
- Project Model status;
- confirmed Must requirements;
- high-priority open questions;
- high-impact assumptions;
- domain entities;
- risks and mitigations;
- generated artifacts;
- artifact freshness states;
- active consistency findings;
- testing and operational evidence in generated documents.

The engine produces:

- overall score and readiness level;
- dimension scores;
- evidence and gaps per dimension;
- blockers with severity and fingerprints;
- prioritized next actions;
- an evidence snapshot with model and artifact provenance.

## AI-assisted assessment

Readiness Assessor prompt version `readiness.v2` now requires all eight dimensions, including operations.

The import flow is:

```text
Run Readiness Assessor
→ human review
→ approve run
→ import approved assessment
→ normalize output
→ conservative score calculation
→ immutable PostgreSQL snapshot
```

Each approved run can be imported only once. Older approved outputs that omit operations remain importable; normalization inserts an explicit zero-score operations gap rather than inventing evidence.

## Persistence

Migration `0011_readiness_dashboard.sql` creates:

- `readiness_assessments`;
- `readiness_dimension_scores`;
- `readiness_blockers`;
- `readiness_actions`;
- `readiness_review_events`.

Assessments and dimension scores are immutable. Blocker and action lifecycle fields are mutable only through protected RPC functions.

## Human follow-up

Organization owners and admins can update blocker states:

```text
open
accepted
resolved
dismissed
```

They can update action states:

```text
pending
in_progress
completed
dismissed
```

Every transition creates an append-only event. Members retain read access but cannot manage lifecycle states.

## Database boundary

`record_readiness_assessment` validates project membership, source type, model version, score range, all eight dimensions, blocker/action payloads and approved AI source runs.

`review_readiness_blocker` and `review_readiness_action` require `is_org_admin`, lock the selected row and append an audit event.

Direct authenticated writes to readiness tables are revoked.

## Important limitation

Readiness is advisory. A score does not authorize production deployment, legal compliance, security acceptance or budget approval. Human owners remain accountable for decisions and evidence quality.
