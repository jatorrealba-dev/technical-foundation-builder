# Validation Report — Consistency Engine v6

## Local validation

The release was validated from the Governance v5 full package with no `.env.local`, secrets, `.git`, `.next` or `node_modules` included in the release archives.

Commands:

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
```

Expected automated coverage:

- stable consistency fingerprints;
- accent-insensitive and identifier-based traceability matching;
- missing artifact detection;
- unconfirmed `must` requirement detection;
- high-impact assumption detection;
- high-priority open-question detection;
- requirement-to-document traceability gaps;
- entity-to-document traceability gaps;
- approved AI output normalization and artifact-name mapping;
- all previous governance and review tests.

## Connected validation required

After applying migration `0010_consistency_engine.sql`:

1. Open a project with a Project Model.
2. Run the deterministic consistency scan.
3. Confirm a scan and findings are created.
4. Mark one finding `accepted`, then `resolved`.
5. Run the scan again while the issue remains present and confirm the resolved finding reopens.
6. Run `Consistency Reviewer`, approve its result and import it from Consistency Engine.
7. Attempt a second import and confirm the existing scan is reused.
8. Verify a `member` can read but cannot change finding status.
9. Open a historical scan snapshot and confirm it does not change when the current finding status changes.

## Intentional limitations

- deterministic traceability uses normalized exact label or identifier presence, not embeddings;
- findings do not automatically edit the Project Model or documents;
- assignment and notifications are deferred to the collaboration phase;
- automatic scans after every Project Model mutation are deferred until background workflows are introduced;
- production-grade database integration tests still require a disposable Supabase environment.
