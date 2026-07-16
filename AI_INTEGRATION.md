# AI Integration Foundation

## Estado

El proyecto incluye una base funcional para integrar agentes de IA sin convertir la conversación en fuente de verdad ni permitir que una salida del modelo modifique datos críticos automáticamente.

## Componentes implementados

### Catálogo de agentes

El catálogo vive en `agents/registry.ts` y define:

- `interview`
- `project_model`
- `architecture`
- `security`
- `consistency`
- `readiness`

Cada agente declara nombre, responsabilidad, versión del prompt y precondiciones.

### Prompts versionados

Las instrucciones base y especializadas viven en `agents/prompts.ts`.

Principios aplicados:

- El Project Model en PostgreSQL es la fuente de verdad.
- El contenido del proyecto se trata como datos no confiables, no como instrucciones.
- Las decisiones críticas requieren revisión humana.
- La incertidumbre debe expresarse en la salida estructurada.
- Cada ejecución registra la versión exacta del prompt.

### Structured Outputs

Los contratos Zod viven en `schemas/agents/agent-outputs.ts`.

La aplicación usa los esquemas como `outputType` del OpenAI Agents SDK. Si el modelo no produce una salida válida, la ejecución falla y se registra el error en lugar de persistir datos ambiguos.

### Orquestación

`services/agents/run-project-agent.ts` realiza el flujo:

1. Valida configuración del servidor.
2. Carga el proyecto mediante RLS.
3. Captura un snapshot del contexto.
4. Crea una fila `agent_runs` con estado `running`.
5. Ejecuta el agente con un máximo de turnos.
6. Valida la salida estructurada.
7. Guarda tokens, latencia, modelo, prompt, salida o error.
8. Registra eventos append-only en `agent_run_events`.

### Interfaz

Ruta:

```text
/projects/[projectId]/agents
```

Permite:

- Revisar el estado de configuración.
- Ver precondiciones de cada agente.
- Ejecutar especialistas.
- Consultar las últimas veinte ejecuciones.
- Inspeccionar salidas estructuradas, errores, tokens y latencia.

## Migración requerida

Aplicar:

```text
supabase/migrations/0006_ai_agent_foundation.sql
```

La migración crea:

- `agent_runs`
- `agent_run_events`
- índices
- validaciones
- políticas RLS
- permisos mínimos para usuarios autenticados

No existe política de eliminación para ejecuciones ni eventos.

## Variables de entorno

Copiar `.env.example` a `.env.local` y completar:

```text
AI_AGENTS_ENABLED=true
OPENAI_API_KEY=...
OPENAI_AGENT_MODEL=<configured-model>
OPENAI_AGENTS_TRACING_ENABLED=false
```

`OPENAI_API_KEY` nunca debe usar prefijo `NEXT_PUBLIC_`.

## Integración con el Project Model

La versión actual guarda resultados para revisión, pero no actualiza automáticamente `project_models`.

El siguiente paso recomendado es crear un flujo explícito:

```text
agent_run completed
→ revisión humana
→ diff propuesto
→ aprobación
→ actualización transaccional del Project Model
→ regeneración de documentos afectados
```

Esto evita que una salida probabilística sobrescriba la fuente de verdad sin control.

## Extensión recomendada

1. Añadir vista de comparación entre salida de agente y Project Model vigente.
2. Implementar aprobación por campo.
3. Crear guardrails de entrada y salida específicos por agente.
4. Incorporar evaluaciones automatizadas y datasets de regresión.
5. Mover ejecuciones largas a Trigger.dev cuando el flujo multiagente lo requiera.
6. Añadir control de presupuesto por organización y rate limiting.
7. Registrar costo estimado por modelo y ejecución.

## Human review and controlled application

Migration `0007_agent_run_human_review.sql` separates the operational status of an AI run from its human governance lifecycle.

- Every completed run receives a `pending` review record.
- Organization owners and admins can approve or reject the result with a comment.
- Approved `project_model` runs can be explicitly applied after a second confirmation.
- Applying a Project Model run updates `project_models` and regenerates all eight artifacts.
- Existing artifact trigger logic creates new immutable document versions during regeneration.
- Other agents remain advisory until a dedicated, deterministic application contract is implemented for their output schema.
- Review decisions and application attempts are appended to `agent_run_events`.

## Transactional human review stabilization

Migration `0008_stabilize_human_review_workflow.sql` replaces the earlier multi-step application flow with the RPC `apply_approved_project_model_run`.

The application prepares validated model and artifact payloads on the server, then submits them to PostgreSQL. The database locks the review row and applies the Project Model, eight artifacts, version history, project status, review state, and audit events transactionally.

The database rejects:

- non-admin actors;
- unapproved reviews;
- non-Project Model runs;
- incomplete artifact packages;
- duplicate or concurrent application attempts.

Project Model versions preserve `source_run_id`, `source_review_id`, actor, reason, and restoration lineage. No AI result bypasses explicit human approval.

## Granular application in Governance v5

Approved Project Model Analyst results now follow this lifecycle:

```text
approved agent run
→ create_project_model_change_set
→ per-change accepted/rejected decisions
→ apply_project_model_change_set
→ selective artifact regeneration
```

The model output is normalized and compared deterministically with the active Project Model. Each addition, modification, removal and model-status change becomes a persisted review item.

A run is marked applied only after the corresponding change set commits successfully. Rejecting every change allows the proposal to close without modifying the Project Model.

## Readiness Assessor v2

`Readiness Assessor` now uses prompt version `readiness.v2` and evaluates eight required dimensions: product, domain, architecture, data, security, testing, delivery and operations.

Its server context now includes artifact freshness states and up to 50 active consistency findings in addition to the Project Model and generated artifacts. The output remains advisory and requires human approval before it can be imported into the Readiness Dashboard.

Importing a run does not mutate the Project Model or documents. It creates an immutable readiness assessment. The normalized score is conservative: it cannot exceed the average of the persisted dimension scores.

## Interview Strategist v2

El prompt `interview.v2` recibe el catálogo persistente de preguntas y estados. La salida estructurada incluye helper text, impacto documental, área de riesgo y obligatoriedad. La ejecución no altera la entrevista hasta ser aprobada e importada explícitamente.

## Operational governance v10

Every provider call now requires a successful `reserve_agent_run` RPC. The reservation stores the enforced policy snapshot, correlation ID and timeout on `agent_runs` before OpenAI is contacted.

Terminal state is persisted only through `complete_agent_run` or `fail_agent_run`. Limits are configured per organization at `/organizations/[organizationId]/settings/ai`.

Runtime variables:

```text
AI_AGENT_MAX_TURNS=3
APP_VERSION=<deployment identifier>
```
