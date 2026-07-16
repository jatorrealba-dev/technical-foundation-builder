# Architecture — Technical Foundation Builder

## 1. Resumen

Technical Foundation Builder será una aplicación web SaaS construida como monolito modular inicialmente. La arquitectura debe permitir crecer hacia colaboración, generación de documentos, agentes especializados, exportación y revisión de consistencia sin introducir microservicios prematuramente.

## 2. Stack inicial

- Next.js + TypeScript
- React
- Tailwind CSS
- shadcn/ui
- Supabase PostgreSQL
- Supabase Auth
- Supabase Storage
- OpenAI Responses API / Agents SDK
- Trigger.dev
- Vercel
- GitHub Actions

## 3. Componentes principales

### Web App

Responsable de UI, dashboard, entrevista, visualización de documentos, readiness score, exportaciones y gestión de proyectos.

### Application Backend

Implementado dentro de Next.js mediante server actions, route handlers y servicios de dominio.

### Project Model Service

Mantiene la fuente estructurada de verdad del proyecto.

### Interview Engine

Crea preguntas, determina etapas, detecta información faltante y prioriza preguntas.

### AI Orchestrator

Prepara contexto, invoca modelos, valida salidas estructuradas, delega a especialistas y registra trazas.

### Artifact Generator

Genera Markdown, PDF, ZIP y versiona artefactos.

### Consistency Engine

Detecta contradicciones, gaps de seguridad, gaps de pruebas e información incompleta.

### Readiness Engine

Calcula preparación por producto, dominio, arquitectura, datos, seguridad, pruebas y entrega.

### Workflow Runner

Trigger.dev ejecuta procesos largos como generación completa, revisión multiagente y exportaciones.

## 4. Fuente de verdad

La conversación no es la fuente de verdad. La fuente de verdad es el Project Model almacenado en PostgreSQL.

## 5. Flujo de generación

Usuario responde entrevista → backend guarda respuesta → AI Orchestrator extrae información estructurada → Project Model se actualiza → Consistency Engine revisa contradicciones → Readiness Engine recalcula score → Artifact Generator produce documentos → usuario revisa y exporta.

## 6. Principios arquitectónicos

- Monolito modular al inicio.
- PostgreSQL como fuente de verdad.
- Documentos como artefactos derivados.
- IA supervisada por reglas y validación.
- Decisiones críticas aprobadas por humanos.
- Separación entre generación, validación y persistencia.
- Versionado de artefactos.
- Multi-tenancy desde el inicio.
- Auditoría de operaciones importantes.

## 7. Carpetas propuestas

```text
technical-foundation-builder/
├── app/
├── components/
├── domain/
├── services/
├── agents/
├── trigger/
├── supabase/
├── schemas/
├── tests/
├── docs/
└── scripts/
```

## 8. Primer vertical slice técnico

Crear cuenta → crear organización → crear proyecto → describir idea → generar preguntas → responder pregunta → extraer requisito → generar Product Spec parcial → mostrar readiness parcial.

## Human-reviewed AI transaction boundary

The application boundary for approved Project Model changes is PostgreSQL, not a sequence of independent Server Action writes.

```text
Next.js validates and generates payloads
→ PostgreSQL RPC locks review
→ Project Model write
→ Project Model version trigger
→ eight artifact writes
→ artifact version triggers
→ review and audit completion
→ commit
```

This boundary prevents partial state when document regeneration or audit persistence fails. Model generation remains deterministic in application code; state transition and concurrency control remain in the database.

## Project Model Governance boundary

Governance v5 introduces a change-set boundary between probabilistic AI output and the Project Model source of truth.

```text
Agent output or manual editor
→ deterministic diff service
→ persisted change set
→ decisions per change
→ deterministic merge
→ PostgreSQL transactional application
→ selective artifact regeneration
→ immutable version and provenance
```

Application code owns diffing, validation, deterministic merge and Markdown generation. PostgreSQL owns authorization, row locking, lifecycle transitions, persistence atomicity and audit lineage.

The old whole-model AI application path is no longer executable by the authenticated role.

## Consistency Engine v6 boundary

Consistency analysis is separated into deterministic detection, probabilistic AI review and governed persistence.

```text
Project Model + artifacts + freshness states
→ deterministic rules or approved Consistency Reviewer output
→ normalized finding drafts
→ PostgreSQL scan transaction
→ fingerprint deduplication
→ immutable scan snapshot
→ persistent current finding state
→ human lifecycle decision
```

Application code owns rule execution, artifact-name normalization and fingerprint generation. PostgreSQL owns project membership validation, AI-review validation, serialization, deduplication, recurrence handling and event audit.

Consistency findings are advisory. They never mutate the Project Model or artifacts automatically.

## Readiness Dashboard v7 boundary

Readiness is calculated outside PostgreSQL and persisted through a strict transactional boundary.

```text
Project Model + interview + artifacts + freshness + consistency findings
→ deterministic engine or approved Readiness Assessor output
→ normalization and conservative scoring
→ PostgreSQL validation RPC
→ immutable assessment and dimension scores
→ reviewable blockers and actions
→ append-only lifecycle audit
```

Application code owns deterministic scoring, evidence interpretation, AI-output normalization and readiness-level mapping. PostgreSQL owns project membership validation, approved-run validation, source-run idempotency, payload constraints, persistence and owner/admin lifecycle transitions.

Readiness never mutates the Project Model, artifacts or consistency findings. It is a derived, historical decision-support layer.

## Adaptive Interview v8

La capa de entrevista se divide en cuatro responsabilidades: catálogo persistente, reglas deterministas, importación gobernada de IA y RPC transaccionales. El contexto de agentes incluye preguntas, estados y el último diagnóstico para evitar repetición. El Project Model consume tanto respuestas base como adaptativas.

## Collaboration and Teams v9 boundary

Organization membership changes are protected by a PostgreSQL governance boundary.

```text
Next.js Server Action
→ security-definer RPC
→ actor role validation
→ invitation or membership row lock
→ lifecycle transition
→ append-only membership event
→ commit
```

Invitation secrets are generated once, returned to the creator and stored only as SHA-256 hashes. Acceptance validates authentication, normalized email, status and expiry in the same transaction that creates the membership.

The dashboard supports multiple organization memberships explicitly. Project creation carries the selected organization ID rather than relying on the first membership returned by the database.

Project-specific ACLs remain outside the v9 boundary.

## Production Hardening v10 boundary

Agent execution now crosses a reservation boundary before any provider request:

```text
Server Action
→ load authorized project context
→ reserve_agent_run
→ atomic budget and concurrency checks
→ OpenAI execution with policy timeout
→ complete_agent_run or fail_agent_run
→ structured correlation log
```

PostgreSQL is authoritative for organization policy, active-run serialization, usage limits and terminal run transitions. Application code owns provider invocation, output validation, timeout observation, error sanitization and structured logs.

Health checks are split into liveness (`/api/health`) and dependency readiness (`/api/health/ready`). The readiness endpoint calls a minimal anonymous database RPC and reports only operational status.
