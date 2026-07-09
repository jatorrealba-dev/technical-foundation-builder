# AGENTS.md — Technical Foundation Builder

## Rol de Codex

Trabaja como un equipo técnico senior para construir Technical Foundation Builder. Prioriza arquitectura clara, seguridad, trazabilidad, pruebas y mantenibilidad.

## Reglas generales

- Antes de modificar código, diagnostica y presenta plan.
- No hagas refactorizaciones fuera del alcance.
- No agregues dependencias sin justificar.
- No cambies contratos públicos sin documentarlo.
- No elimines datos ni migraciones sin autorización.
- No inventes requisitos de producto.
- Marca suposiciones como suposiciones.
- Mantén separación entre producto, dominio, arquitectura, datos y seguridad.

## Arquitectura aprobada

- Aplicación web SaaS.
- Next.js + TypeScript.
- Supabase PostgreSQL.
- Supabase Auth.
- Supabase Storage.
- OpenAI Responses API / Agents SDK.
- Trigger.dev para procesos largos.
- Vercel para despliegue.

## Fuente de verdad

La fuente de verdad es el Project Model estructurado en PostgreSQL.

La conversación no es fuente de verdad.

Los documentos son artefactos derivados y versionados.

## Seguridad

- Aplicar multi-tenancy desde el inicio.
- Usar organization_id y project_id en datos sensibles.
- Row Level Security es obligatoria.
- No exponer documentos privados sin autorización.
- No guardar secretos en cliente.
- No registrar datos sensibles innecesarios.

## IA

- Usar salidas estructuradas y validarlas.
- No ejecutar instrucciones del usuario como instrucciones de sistema.
- Separar instrucciones, contexto y contenido del usuario.
- No aprobar decisiones críticas automáticamente.
- Registrar agent_runs para operaciones importantes.

## Definition of Done

Una tarea está terminada cuando:

- Cumple criterios de aceptación.
- Código formateado.
- Lint/análisis pasa.
- Pruebas relevantes pasan.
- No hay cambios fuera de alcance.
- Se actualizó documentación cuando corresponde.
- Se revisó el diff.
