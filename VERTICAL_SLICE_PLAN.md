# Vertical Slice Plan — Technical Foundation Builder

## Objetivo

Construir el primer flujo completo de extremo a extremo para validar la arquitectura y la propuesta principal.

## Flujo

Usuario se registra → crea organización → crea proyecto → describe idea → sistema genera preguntas iniciales → usuario responde → sistema extrae requisitos → genera Product Spec parcial → calcula Readiness Score parcial → permite exportar Markdown.

## Componentes involucrados

### Frontend

- Página de login.
- Dashboard.
- Página de creación de proyecto.
- Pantalla de entrevista.
- Vista de documento generado.
- Vista de readiness parcial.

### Backend

- Auth.
- Organization service.
- Project service.
- Interview service.
- AI orchestrator.
- Artifact generator.
- Readiness engine.

### Datos

- organizations.
- organization_members.
- projects.
- interview_sessions.
- interview_questions.
- interview_answers.
- requirements.
- artifacts.
- artifact_versions.
- readiness_scores.
- agent_runs.

### IA

- Generación de preguntas iniciales.
- Extracción de requisitos.
- Generación de Product Spec parcial.

## Criterios de aceptación

- Usuario puede registrarse.
- Usuario puede crear organización.
- Usuario puede crear proyecto.
- Usuario puede describir una idea.
- Sistema genera al menos cinco preguntas relevantes.
- Usuario puede responder preguntas.
- Sistema extrae al menos tres requisitos estructurados.
- Sistema genera un Product Spec parcial.
- Sistema calcula readiness parcial.
- Usuario puede exportar Product Spec en Markdown.

## Riesgos

- Preguntas demasiado genéricas.
- Respuestas de IA no estructuradas.
- RLS mal configurado.
- Costos altos por generación repetida.
- Documentos convincentes pero incorrectos.

## Mitigaciones

- Usar schemas.
- Guardar agent_runs.
- Limitar contexto enviado.
- Marcar suposiciones.
- Requerir aprobación de decisiones críticas.
- Agregar pruebas de RLS.
