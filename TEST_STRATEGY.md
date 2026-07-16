# Test Strategy — Technical Foundation Builder

## 1. Objetivo

Garantizar que la plataforma pueda recopilar información, estructurarla, generar documentos y proteger datos de organizaciones distintas sin regresiones críticas.

## 2. Tipos de pruebas

### Unit tests

Para Project Model Service, Readiness Engine, Consistency Engine, Artifact Generator, validadores de schemas y helpers de permisos.

### Integration tests

Para crear proyecto, guardar entrevista, extraer requisitos, generar documentos, exportar paquete y probar RLS.

### End-to-end tests

Flujo MVP:

1. Usuario se registra.
2. Crea organización.
3. Crea proyecto.
4. Describe idea.
5. Responde entrevista.
6. Genera Product Spec.
7. Exporta paquete.

### Security tests

Casos críticos:

- Usuario A no puede leer proyectos de organización B.
- Viewer no puede editar proyecto.
- Member no puede cambiar permisos de organización.
- URL privada no puede descargarse sin permiso.
- Exportación requiere autorización.

### AI output tests

Validar que:

- Respuestas estructuradas cumplen schema.
- Supuestos se marcan correctamente.
- Preguntas críticas faltantes se detectan.
- Documentos no omiten información confirmada.
- Contradicciones simples son detectadas.

## 3. Herramientas sugeridas

- Vitest.
- Testing Library.
- Playwright.
- Supabase local.
- Zod para validación.
- GitHub Actions.

## 4. Pruebas mínimas del MVP

- Crear proyecto.
- Crear entrevista.
- Guardar respuesta.
- Extraer requisito.
- Generar Product Spec.
- Calcular readiness.
- Exportar Markdown.
- Validar aislamiento de organización.

## 5. Definition of test complete

Una funcionalidad está probada cuando:

- Tiene pruebas unitarias si contiene lógica.
- Tiene prueba de integración si toca base de datos.
- Tiene prueba E2E si pertenece al flujo crítico.
- Tiene prueba de permisos si expone datos.
- Pasa en CI.

## Stabilization v4 automated coverage

`npm run test` uses the Node.js test runner for deterministic domain tests without OpenAI or Supabase credentials.

Current coverage includes:

- organization role review permissions;
- Project Model diff detection;
- removal of non-persistent AI evidence during normalization.

GitHub Actions runs `npm ci` and `npm run check` on pushes and pull requests. Connected Supabase transaction, RLS, and concurrency checks remain documented manual integration tests until a disposable CI database is introduced.

## Governance v5 coverage

The deterministic test suite now covers:

- granular Project Model change creation;
- additions, modifications and removals;
- general model status changes;
- accepted-only application;
- exclusion of rejected changes;
- selective artifact-impact union and deduplication.

Connected tests remain necessary for PostgreSQL row locking, RLS, RPC authorization, trigger-created versions and selective artifact persistence. Read-only verification queries are provided in `supabase/tests/0009_governance_verification.sql`.

## Consistency Engine v6 coverage

The deterministic test suite now covers fingerprint stability, normalized traceability matching, missing artifacts, unconfirmed mandatory requirements, high-impact assumptions, high-priority questions, requirement and entity document gaps, and normalization of Consistency Reviewer outputs.

Connected database verification must cover RLS, source-run import idempotency, advisory-lock concurrency, immutable snapshots, lifecycle audit and automatic reopening of recurring resolved findings. Read-only verification queries are in `supabase/tests/0010_consistency_engine_verification.sql`.

## Readiness Dashboard v7 coverage

The deterministic suite now covers:

- stable readiness fingerprints;
- score-to-level thresholds;
- mandatory production of all eight dimensions;
- critical blocker score caps;
- low-readiness detection from missing evidence;
- positive scoring from coherent current artifacts;
- testing evidence detection;
- operations evidence detection;
- conservative normalization of Readiness Assessor output;
- safe handling of older AI outputs without an operations dimension.

Connected database verification must cover RLS, exactly-eight-dimension integrity, AI import idempotency, Project Model version provenance, owner/admin lifecycle transitions and append-only review events. Queries are provided in `supabase/tests/0011_readiness_dashboard_verification.sql`.

## Adaptive Interview v8

La suite cubre fingerprints, similitud semántica, reglas deterministas, deduplicación y normalización de salidas del agente. La validación conectada debe cubrir RLS, backfill, transiciones, importación única y auditoría.

## Collaboration and Teams v9 tests

Unit coverage includes:

- owner/admin/member team-management rules;
- invitation role hierarchy;
- owner-only role changes;
- removal safeguards for owner, admin peers and self;
- normalized invitation email;
- open-redirect prevention.

Connected Supabase tests must cover invitation token lifecycle, exact-email acceptance, duplicate protection, owner transfer serialization, role-change authorization and audit persistence. Use `supabase/tests/0013_collaboration_and_teams_verification.sql` after the manual flow.

## Production Hardening v10 tests

The automated suite covers policy authorization, usage percentage boundaries, runtime error classification and timeout behavior. Connected verification must additionally exercise PostgreSQL concurrency, daily limits, monthly token limits, stale-run recovery and health readiness after migration `0014`.

CI runs `npm run check` followed by `npm run audit:high`. Moderate advisories remain visible but do not block delivery; high and critical advisories do.
