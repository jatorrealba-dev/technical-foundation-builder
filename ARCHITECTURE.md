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
