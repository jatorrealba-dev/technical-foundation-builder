# Consistency Engine v6

## Purpose

Consistency Engine turns document-review observations into persistent, deduplicated and human-governed findings.

It combines two sources:

1. deterministic rules that run without API usage;
2. approved `Consistency Reviewer` outputs produced by the AI agent foundation.

Neither source changes the Project Model or generated documents automatically.

## Routes

```text
/projects/[projectId]/consistency
/projects/[projectId]/consistency/scans/[scanId]
```

The main route contains:

- current finding counters;
- deterministic scan execution;
- approved AI-run import;
- status, severity and category filters;
- finding review controls;
- occurrence and event history;
- scan history and immutable scan snapshots.

## Deterministic rule set v1

The first deterministic rule set checks:

- missing registered artifacts;
- artifacts whose freshness state is not `current`;
- unconfirmed `must` requirements;
- `must` requirements missing from Product Spec, MVP Scope, Backlog or Vertical Slice Plan;
- unresolved domain entities;
- entities missing from Domain Model or Data Model;
- high-impact assumptions that remain unconfirmed;
- high-priority open questions;
- risks without a sufficiently explicit mitigation;
- high-impact or high-probability risks missing from Architecture or Security.

The rules are conservative string-based traceability checks. They do not claim semantic equivalence and their findings require human review.

## AI import flow

```text
Run Consistency Reviewer
→ review structured output
→ approve run
→ open Consistency Engine
→ import approved findings
→ deduplicate by fingerprint
→ review each finding lifecycle
```

An AI run may be imported only once. Concurrent imports are serialized in PostgreSQL.

## Finding lifecycle

```text
open
accepted
resolved
dismissed
```

- `open`: detected and not yet triaged;
- `accepted`: acknowledged as valid work that remains outstanding;
- `resolved`: evidence indicates the inconsistency was corrected;
- `dismissed`: reviewed and considered not applicable or incorrect.

A resolved finding is automatically reopened if a later scan detects the same fingerprint again. Dismissed and accepted findings preserve their human decision when observed again.

## Persistence model

Migration `0010_consistency_engine.sql` adds:

### `consistency_scans`

Immutable scan metadata, source, Project Model version, counts and summary.

### `consistency_findings`

Current deduplicated finding state per project and fingerprint.

### `consistency_scan_findings`

Immutable snapshot of every finding observed in a specific scan.

### `consistency_finding_events`

Audit history for creation, recurrence, automatic reopening and human status decisions.

## Security boundary

Authenticated organization members may:

- read scans, findings, snapshots and events;
- execute deterministic scans;
- import an approved Consistency Reviewer run.

Only organization `owner` and `admin` roles may change finding status.

Authenticated users receive no direct insert, update or delete privileges on consistency tables. All writes use security-definer RPC functions that validate membership, role, source run, approval state and JSON payload shape.

## Database functions

```text
record_consistency_scan
review_consistency_finding
```

`record_consistency_scan` serializes writes per project with an advisory transaction lock, validates duplicate fingerprints and reuses an existing scan when the same AI run is imported concurrently.

## Validation

```bash
npm run check
npx supabase db push
```

The remote push should propose only:

```text
0010_consistency_engine.sql
```

Connected verification queries are in:

```text
supabase/tests/0010_consistency_engine_verification.sql
```
