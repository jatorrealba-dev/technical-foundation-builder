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
OPENAI_AGENT_MODEL=gpt-5.6
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
