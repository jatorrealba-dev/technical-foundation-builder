# Validation — Readiness Dashboard v7

## Local validation

Run:

```bash
npm run check
```

Expected result:

- ESLint passes;
- TypeScript passes;
- 19 deterministic tests pass;
- production build includes readiness routes.

Expected routes:

```text
/projects/[projectId]/readiness
/projects/[projectId]/readiness/assessments/[assessmentId]
```

## Database migration

Apply:

```bash
npx supabase db push
```

Expected migration:

```text
0011_readiness_dashboard.sql
```

Read-only verification queries are available in:

```text
supabase/tests/0011_readiness_dashboard_verification.sql
```

## Connected functional validation

1. Open a project with a generated Project Model.
2. Navigate to Readiness.
3. Run the deterministic assessment.
4. Confirm that eight dimension scores are created.
5. Confirm that a historical assessment card appears.
6. Open the full snapshot.
7. Change a blocker to accepted or resolved as owner/admin.
8. Change a recommended action to in progress or completed.
9. Confirm that audit events appear in the snapshot.
10. Run another deterministic assessment and verify historical trend preservation.

## AI validation

1. Run Readiness Assessor once using the current prompt.
2. Approve the completed run in Agents IA.
3. Open Readiness and import the approved run.
4. Confirm that it appears as an AI assessment.
5. Attempt to import the same run again; it must not be offered again and the RPC must remain idempotent.

## Permission validation

- owner/admin: can review blockers and actions;
- member: can read assessments, dimensions, blockers, actions and events;
- member: cannot execute blocker/action review RPCs;
- user outside the organization: cannot read project readiness data.

## Concurrency validation

Submit two imports for the same approved Readiness Assessor run. The unique source-run index and database transaction must preserve a single assessment.
