# Technical Foundation Builder

Aplicación SaaS que transforma una idea de producto en un Project Model estructurado y un paquete técnico versionado.

## Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase Auth + PostgreSQL + RLS
- OpenAI Responses API mediante OpenAI Agents SDK
- Zod Structured Outputs

## Flujo funcional

```text
Registro
→ organización
→ proyecto
→ entrevista
→ Project Model
→ documentos técnicos
→ historial de versiones
→ ZIP
→ agentes de IA auditables
```

## Instalación

```bash
npm install
cp .env.example .env.local
npm run dev
```

Completa las variables públicas de Supabase en `.env.local`.

## Migraciones

Las migraciones están en `supabase/migrations`.

Orden actual:

```text
0001_initial_foundation_schema.sql
0002_harden_organization_ownership.sql
0003_unique_interview_session_per_project.sql
0004_allow_creators_to_read_organizations.sql
0005_artifact_versions.sql
0006_ai_agent_foundation.sql
```

Después de vincular Supabase CLI:

```bash
npx supabase db push
```

## Agentes de IA

La integración está deshabilitada por defecto. Para habilitarla:

```text
AI_AGENTS_ENABLED=true
OPENAI_API_KEY=...
OPENAI_AGENT_MODEL=gpt-5.6
OPENAI_AGENTS_TRACING_ENABLED=false
```

Ruta del proyecto:

```text
/projects/[projectId]/agents
```

Los agentes generan salidas estructuradas y guardan ejecuciones auditables. No actualizan automáticamente el Project Model.

Consulta `AI_INTEGRATION.md` para arquitectura, seguridad y próximos pasos.

## Validación

```bash
npm run check
```

El comando ejecuta lint, typecheck y build de producción.
