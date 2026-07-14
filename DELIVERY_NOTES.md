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
OPENAI_AGENT_MODEL=gpt-5.6
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
