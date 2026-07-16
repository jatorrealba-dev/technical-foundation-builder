# Delivery Notes — AI-ready foundation

## Resultado

Esta entrega consolida el vertical slice existente y deja una integración funcional para agentes de IA, deshabilitada por defecto hasta que se configuren credenciales del servidor.

## Cambios principales

### Historial de artefactos

- Navegación visible desde cada documento.
- Conteo de versiones por artefacto.
- Historial mostrado antes de la previsualización extensa.
- Descarga individual de versiones.
- Restauración de una versión histórica como una nueva versión vigente.
- Conservación del historial inmutable mediante el trigger de `0005_artifact_versions.sql`.

### Runtime de agentes

- Catálogo de seis especialistas:
  - entrevista
  - Project Model
  - arquitectura
  - seguridad
  - consistencia
  - readiness
- OpenAI Agents SDK en servidor.
- Contratos Zod para Structured Outputs.
- Prompts especializados y versionados.
- Contexto estructurado cargado mediante RLS.
- Separación explícita entre instrucciones confiables y contenido de proyecto no confiable.
- Límite de contexto por artefacto para controlar tamaño de entrada.
- Registro de modelo, prompt, input snapshot, output, tokens, latencia y errores.
- Resultados para revisión humana; no modifican automáticamente el Project Model.

### Persistencia y seguridad

La migración `0006_ai_agent_foundation.sql` agrega:

- `agent_runs`
- `agent_run_events`
- restricciones de estado, agente, tokens y latencia
- índices por proyecto, agente y fecha
- RLS por membresía de organización
- permisos mínimos
- historial sin políticas de eliminación

### Interfaz

Nueva ruta:

```text
/projects/[projectId]/agents
```

Incluye:

- estado seguro de configuración
- precondiciones por agente
- ejecución manual
- historial de veinte ejecuciones
- salida estructurada
- tokens, latencia y errores
- manejo explícito cuando falta la migración

### Robustez del build

Se eliminaron dependencias de Google Fonts durante el build. La aplicación usa una pila tipográfica del sistema, por lo que puede compilar en CI o entornos sin acceso externo a fuentes.

## Activación

1. Instalar dependencias:

```bash
npm install
```

2. Crear el entorno local:

```bash
cp .env.example .env.local
```

3. Completar Supabase y aplicar migraciones:

```bash
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
```

4. Configurar el runtime de IA:

```text
AI_AGENTS_ENABLED=true
OPENAI_API_KEY=...
OPENAI_AGENT_MODEL=<configured-model>
OPENAI_AGENTS_TRACING_ENABLED=false
```

5. Validar:

```bash
npm run check
```

6. Ejecutar:

```bash
npm run dev
```

## Límites intencionales

- Las salidas de IA no escriben sobre `project_models` automáticamente.
- No se incluyeron claves ni archivos `.env`.
- Las ejecuciones largas siguen siendo síncronas; antes de producción deben moverse a un workflow runner o background job.
- Falta implementar aprobación por campo, diffs contra el Project Model, presupuestos por organización, rate limiting y evaluaciones de regresión.

## Human review phase

Added migration `0007_agent_run_human_review.sql` and a controlled review workflow in `/projects/[projectId]/agents`.

The Project Model Analyst is the only agent whose approved output can be applied automatically in this phase. Applying it regenerates the complete document package and relies on artifact version triggers to preserve prior content. All other agents are reviewable but advisory.

## Stabilization v4 delivery

Added migration `0008_stabilize_human_review_workflow.sql`, transactional AI application, Project Model history/restoration, permission-aware review UI, impact previews, automated domain tests, and CI.

Apply the migration and complete the connected checks in `STABILIZATION_V4.md` before merging this release into the production branch.

## Project Model Governance v5 delivery

Added migration `0009_project_model_governance.sql`, granular AI change proposals, a full Project Model editor, selective document regeneration, artifact freshness provenance, change-set audit lineage and nine deterministic tests.

Apply migration 0009 before opening the new governance routes. Complete the connected checks in `VALIDATION_V5.md` before merging the release.

## Consistency Engine v6 delivery

Added migration `0010_consistency_engine.sql`, deterministic consistency rules, import of approved Consistency Reviewer results, deduplicated finding lifecycle, immutable scan snapshots, event audit, project dashboard integration and fourteen deterministic tests.

Apply migration 0010 before opening the consistency routes. Complete the connected checks in `VALIDATION_V6.md` before merging the release.

## v7 — Readiness Dashboard

- Added deterministic readiness engine with eight dimensions.
- Added immutable readiness assessments and historical trend.
- Added persistent blockers and next actions.
- Added owner/admin lifecycle review with audit events.
- Added one-time import of approved Readiness Assessor runs.
- Bumped Readiness Assessor prompt to `readiness.v2`.
- Added artifact freshness and active consistency findings to AI context.
- Added 5 readiness tests; total deterministic tests: 19.
- Added migration `0011_readiness_dashboard.sql` and connected verification queries.

## v8 — Adaptive Interview

Se sustituyó el flujo de siete preguntas estáticas por un catálogo gobernado compatible con las preguntas base. Se añadieron seguimientos deterministas, importación aprobada de Interview Strategist v2, deduplicación, lifecycle de preguntas, auditoría e integración con Project Model y Readiness.

## v9 — Collaboration and Teams

Adds secure shareable organization invitations, team management, role transitions, ownership transfer, membership exit, audit events and multi-organization switching. No external email service or project-specific ACL is introduced in this release.
