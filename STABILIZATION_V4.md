# Stabilization v4

This release hardens the human-reviewed AI workflow before additional agents or providers are added.

## Completed

- Added transactional application of approved Project Model Analyst results.
- Added row locking and an atomic application-state transition to prevent duplicate application.
- Added `applying` as an explicit application lifecycle state.
- Added immutable `project_model_versions` snapshots.
- Added source links from Project Model versions to agent runs and reviews.
- Added controlled restoration of a historical Project Model version.
- Regenerates all eight artifacts in the same PostgreSQL transaction as Project Model application or restoration.
- Artifact version triggers continue preserving every document state.
- Added owner/admin-only review controls in the UI while retaining server and database enforcement.
- Added client-side pending states to prevent accidental double submission.
- Added structured impact comparison before applying a Project Model proposal.
- Added Project Model history and JSON downloads.
- Added unit tests and GitHub Actions CI.

## Database migration

Apply:

```bash
npx supabase db push
```

Expected migration:

```text
0008_stabilize_human_review_workflow.sql
```

## New route

```text
/projects/[projectId]/analysis/history
```

## Transaction guarantees

`apply_approved_project_model_run` performs the following under one database transaction and a locked review row:

1. Validates authenticated organization-admin access.
2. Validates the completed Project Model Analyst run.
3. Locks and validates its approved review.
4. Validates the proposed Project Model and exactly eight artifact payloads.
5. Updates the Project Model.
6. Creates a Project Model version through the database trigger.
7. Regenerates all eight artifacts.
8. Creates artifact versions through existing triggers.
9. Updates project status.
10. Marks the review as applied and appends audit events.

A write failure rolls back the Project Model, artifacts, and versions before recording a failed application state.

## Manual verification required

The only remaining validation that requires the connected project owner is:

- apply migration 0008 to the remote Supabase project;
- approve and apply one real Project Model Analyst result;
- confirm one new Project Model version and eight new artifact versions;
- submit the same application twice and confirm the second request is rejected;
- restore one historical Project Model version and confirm a new version is created;
- verify a `member` can read reviews but cannot see or invoke management controls.
