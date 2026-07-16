# Validation — Project Model Governance v5

## Automated validation

Run:

```bash
npm run check
```

Expected stages:

```text
ESLint
TypeScript
Node test runner
Next.js production build
```

Governance v5 adds tests for:

- granular add/update/remove detection;
- Project Model status changes;
- accepted-only merge behavior;
- rejected-change exclusion;
- artifact-impact union and deduplication.

## Connected verification after migration

### AI change set

1. Open a project with a current Project Model.
2. Run or select a completed Project Model Analyst execution.
3. Approve the run.
4. Select **Preparar revisión granular**.
5. Accept at least one change and reject at least one change.
6. Review every remaining pending change.
7. Apply the proposal.

Expected:

- the proposal becomes `applied`;
- only accepted changes appear in the current Project Model;
- rejected changes do not appear;
- a new `project_model_versions` row references `source_change_set_id`;
- only impacted artifacts receive new content versions;
- the source `agent_run_reviews` row becomes `applied`.

### All changes rejected

1. Prepare another AI proposal.
2. Reject every change.
3. Select **Cerrar sin aplicar**.

Expected:

- the proposal becomes `rejected`;
- Project Model and artifacts do not change;
- the source review becomes `not_applicable` with audit summary.

### Manual editor

1. Open **Análisis → Editar Project Model**.
2. Modify one domain entity only.
3. Enter a change reason.
4. Save.

Expected:

- a manual change set is created and immediately applied;
- a new Project Model version is created;
- Domain Model, Architecture, Data Model and Security are regenerated;
- unrelated artifacts do not receive a new version;
- Documents shows artifact freshness and model-version provenance.

### Stale proposal and editor protection

1. Open the editor in two browser tabs.
2. Save a change in the first tab.
3. Try to save the second tab without reloading.

Expected: the second save is rejected as stale and no data is overwritten.

For an AI proposal, modify the Project Model after creating the change set and before applying it. Applying the old proposal must return `stale_change_set`.

### Authorization

Validate with a `member` user:

- the user can read proposals and changes;
- the user cannot see management controls;
- direct RPC attempts are rejected by `is_org_admin`.

## SQL verification

Run:

```text
supabase/tests/0009_governance_verification.sql
```

Confirm that `authenticated_can_execute` is false for:

```text
apply_approved_project_model_run
```

and true for the five governance RPC functions.

## Release validation completed

The packaged source was validated locally on 2026-07-15:

```text
ESLint                         passed
TypeScript                     passed
Node tests                     9 passed, 0 failed
Next.js production build       passed
PostgreSQL parser              57 statements parsed
High vulnerabilities           0
Critical vulnerabilities       0
```

The parser check validates SQL syntax at the statement level. The migration still requires execution against the connected Supabase database before the release can be marked end-to-end verified.
