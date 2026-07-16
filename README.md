# Technical Foundation Builder

Technical Foundation Builder es una plataforma SaaS web que ayuda a fundadores, consultores, agencias y desarrolladores nuevos a transformar una idea informal en una base técnica profesional lista para equipos de desarrollo y agentes de programación.

El producto entrevista al usuario, recopila requisitos, detecta supuestos, identifica contradicciones, genera documentos técnicos, calcula un nivel de preparación y exporta un paquete de desarrollo.

## Objetivo inicial

Construir un MVP que permita:

1. Crear una cuenta.
2. Crear un proyecto.
3. Describir una idea.
4. Responder una entrevista guiada.
5. Extraer requisitos estructurados.
6. Generar un paquete técnico inicial.
7. Calcular un Readiness Score.
8. Exportar Markdown, PDF y ZIP.

## Stack propuesto

- Next.js + TypeScript
- React
- Tailwind CSS + shadcn/ui
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- OpenAI Responses API / Agents SDK
- Trigger.dev
- Vercel
- GitHub Actions

## Documentos incluidos

- PROJECT_CHARTER.md
- PRODUCT_SPEC.md
- MVP_SCOPE.md
- DOMAIN_MODEL.md
- ARCHITECTURE.md
- DATA_MODEL.md
- SECURITY.md
- TEST_STRATEGY.md
- BACKLOG.md
- AGENTS.md
- DEFINITION_OF_READY.md
- DEFINITION_OF_DONE.md
- VERTICAL_SLICE_PLAN.md

## Stabilization v4

The human-review workflow is now hardened by `0008_stabilize_human_review_workflow.sql`.

Key capabilities:

- transactional Project Model application and document regeneration;
- protection against duplicate application;
- immutable Project Model history;
- historical Project Model restoration;
- owner/admin-only governance controls;
- structured impact preview before applying AI output;
- unit tests and GitHub Actions CI.

Project Model history is available at:

```text
/projects/[projectId]/analysis/history
```

Validation command:

```bash
npm run check
```

Connected-environment verification steps are documented in `STABILIZATION_V4.md`.

## Project Model Governance v5

Migration `0009_project_model_governance.sql` adds granular change sets, a governed manual editor, selective document regeneration, artifact freshness provenance and Project Model version lineage.

New routes:

```text
/projects/[projectId]/analysis/edit
/projects/[projectId]/analysis/change-sets
/projects/[projectId]/analysis/change-sets/[changeSetId]
```

Approved Project Model Analyst runs no longer apply a complete model directly. They create individually reviewable changes. The legacy direct-application RPC is revoked for authenticated users.

See `PROJECT_MODEL_GOVERNANCE_V5.md` and `VALIDATION_V5.md`.

## Consistency Engine v6

Migration `0010_consistency_engine.sql` adds persistent, deduplicated consistency findings from deterministic rules and approved Consistency Reviewer runs.

New routes:

```text
/projects/[projectId]/consistency
/projects/[projectId]/consistency/scans/[scanId]
```

The engine includes finding lifecycle governance, immutable scan snapshots, recurrence detection, automatic reopening of recurring resolved findings, audit events, filtering and owner/admin-only status controls.

See `CONSISTENCY_ENGINE_V6.md` and `VALIDATION_V6.md`.

## Readiness Dashboard v7

Migration `0011_readiness_dashboard.sql` adds immutable readiness assessments, eight dimension scores, persistent blockers, prioritized next actions and lifecycle audit events.

New routes:

```text
/projects/[projectId]/readiness
/projects/[projectId]/readiness/assessments/[assessmentId]
```

The deterministic engine evaluates interview completeness, Project Model governance, artifact freshness, consistency findings, testing evidence and operational readiness without consuming OpenAI credits. Approved `Readiness Assessor` runs can be imported once as separate historical assessments.

See `READINESS_DASHBOARD_V7.md` and `VALIDATION_V7.md`.

## Adaptive Interview v8

La entrevista ahora usa un catálogo persistente de preguntas con origen, prioridad, estado, motivo, impacto documental y auditoría. Puede generar seguimientos deterministas sin costo de IA e importar preguntas de ejecuciones aprobadas de Interview Strategist v2. Consulta `ADAPTIVE_INTERVIEW_V8.md`.

## Collaboration and Teams v9

Migration `0013_collaboration_and_teams.sql` adds secure organization invitations, role governance, ownership transfer, membership audit events and multi-organization dashboard switching.

New routes:

```text
/organizations/[organizationId]/team
/invitations/[token]
```

Invitation tokens are high entropy and stored only as SHA-256 hashes. Acceptance requires an authenticated account with the exact invited email. Email delivery is manual in this release; the application generates a shareable link.

See `COLLABORATION_AND_TEAMS_V9.md` and `VALIDATION_V9.md`.

## Production Hardening v10

Migration `0014_production_hardening.sql` moves AI execution behind atomic PostgreSQL reservations with organization budgets, daily user limits, concurrency controls, timeouts, stale-run recovery and correlation IDs.

New routes:

```text
/organizations/[organizationId]/settings/ai
/api/health
/api/health/ready
```

The application emits structured JSON logs for agent lifecycle events and exposes no provider secrets in health responses. CI now fails on high or critical dependency advisories while documenting the existing moderate transitive PostCSS advisory.

See `PRODUCTION_HARDENING_V10.md`, `DEPLOYMENT_RUNBOOK.md` and `VALIDATION_V10.md`.
