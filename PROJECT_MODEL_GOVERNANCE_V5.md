# Project Model Governance v5

## Scope

Governance v5 replaces whole-model AI application with a controlled change-set workflow and adds a governed manual editor.

## User flows

### AI proposal

```text
Project Model Analyst completes
→ owner/admin approves the run
→ prepare granular proposal
→ review each add/update/remove
→ accept or reject every change
→ apply accepted changes transactionally
→ version Project Model
→ regenerate only affected artifacts
→ preserve audit lineage
```

### Manual edit

```text
Owner/admin opens Project Model editor
→ edits requirements, assumptions, entities, risks, questions or model status
→ records a reason
→ system calculates granular diff
→ creates an applied manual change set
→ versions Project Model
→ regenerates only affected artifacts
```

## New routes

```text
/projects/[projectId]/analysis/edit
/projects/[projectId]/analysis/change-sets
/projects/[projectId]/analysis/change-sets/[changeSetId]
```

## New persistence

Migration `0009_project_model_governance.sql` creates:

- `project_model_change_sets`
- `project_model_changes`
- `project_artifact_states`

It also adds `source_change_set_id` to `project_model_versions`.

## Change-set states

```text
draft
reviewing
ready
applied
rejected
cancelled
```

## Change decisions

```text
pending
accepted
rejected
```

## Supported change categories

```text
requirement
assumption
domain_entity
risk
open_question
model_status
```

## Supported operations

```text
add
update
remove
```

## Document impact mapping

The application calculates the union of affected document types. Only that set is regenerated.

Examples:

- requirement changes affect Product Spec, MVP Scope, Architecture, Security, Backlog and Vertical Slice Plan;
- domain entity changes affect Domain Model, Architecture, Data Model and Security;
- risk changes affect Product Spec, Architecture, Security, Backlog and Vertical Slice Plan;
- model status changes affect all eight artifacts.

## Transaction boundary

`apply_project_model_change_set` locks the change set and, in one database transaction:

1. validates organization admin authorization;
2. verifies that all changes are reviewed;
3. verifies that at least one change is accepted;
4. validates the computed artifact impact;
5. writes the resulting Project Model;
7. creates the immutable Project Model version through the existing trigger;
8. regenerates only affected artifact rows;
9. updates artifact freshness provenance;
10. closes the source AI review when applicable;
11. records application audit metadata.

The legacy full-model RPC from v4 is revoked for the `authenticated` role.

## Security model

- Organization members can read change sets, changes and artifact freshness through RLS.
- Only owner/admin can create, review, close or apply proposals through security-definer RPC functions.
- The tables do not grant direct insert, update or delete privileges to authenticated users.
- Server Actions repeat authentication and resource validation before preparing payloads.

## Manual editor safeguards

- Zod validates the complete editable model.
- Required text cannot be empty.
- Collection sizes are bounded.
- A reason is mandatory.
- No-op saves are rejected.
- Optimistic concurrency rejects a save when the model changed after the editor was opened.
- Every successful save creates a version and an audit change set.

## Applying migration

```bash
npx supabase db push
```

Expected migration:

```text
0009_project_model_governance.sql
```

Run the read-only verification queries in:

```text
supabase/tests/0009_governance_verification.sql
```
