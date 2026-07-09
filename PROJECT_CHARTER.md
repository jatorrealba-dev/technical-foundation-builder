# Project Charter — Technical Foundation Builder

## 1. Nombre del producto

Technical Foundation Builder

## 2. Problema

Muchas personas tienen ideas para sistemas, aplicaciones o plataformas, pero no saben cómo convertirlas en especificaciones claras, estructuras técnicas, modelos de datos, reglas de negocio, criterios de aceptación y tareas ejecutables para un equipo de desarrollo.

Esto provoca:

- Requisitos incompletos.
- Arquitecturas improvisadas.
- Decisiones técnicas tomadas demasiado pronto.
- Falta de claridad para desarrolladores.
- Cambios de alcance costosos.
- Mala estimación.
- Retrabajo.
- Problemas de seguridad descubiertos tarde.
- Documentación incoherente o inexistente.

## 3. Objetivo del producto

Crear una plataforma SaaS que funcione como un equipo virtual de liderazgo técnico y guíe al usuario desde una idea inicial hasta un paquete profesional listo para implementación.

## 4. Usuarios objetivo

### Fundadores no técnicos

Personas con una idea de producto que necesitan convertirla en un documento técnico comprensible para desarrolladores, agencias o inversionistas.

### Agencias de desarrollo

Equipos que reciben ideas incompletas de clientes y necesitan acelerar el descubrimiento, definición, estimación y handoff técnico.

### Freelancers y consultores

Profesionales que desean estructurar mejor los proyectos de sus clientes antes de cotizar o desarrollar.

### Desarrolladores nuevos

Personas que saben programar parcialmente, pero no saben organizar profesionalmente un proyecto desde cero.

### Equipos internos

Empresas que necesitan estandarizar cómo se definen nuevos sistemas antes de implementarlos.

## 5. Propuesta de valor

La plataforma no solo genera documentos. Convierte una idea en un modelo estructurado del proyecto, detecta información faltante, separa hechos de suposiciones, valida consistencia y produce un paquete técnico listo para desarrollo humano o asistido por agentes.

## 6. Éxito del MVP

El MVP será exitoso si permite que un usuario pase de una idea informal a un paquete inicial con:

- Product Spec.
- MVP Scope.
- Domain Model.
- Architecture.
- Data Model.
- Security baseline.
- Backlog.
- Vertical Slice Plan.
- Readiness Score.
- Exportación del paquete.

## 7. Restricciones iniciales

- No generar código completo del producto del usuario en el MVP.
- No reemplazar revisión profesional humana en proyectos críticos.
- No prometer estimaciones exactas de costo o tiempo.
- No tomar decisiones críticas sin aprobación explícita del usuario.
- No presentar suposiciones de IA como hechos confirmados.

## 8. Decisiones iniciales

- El producto será una aplicación web SaaS.
- El stack inicial será Next.js + Supabase + OpenAI + Trigger.dev.
- PostgreSQL será la fuente principal de datos estructurados.
- Los documentos se generarán desde un Project Model estructurado.
- La entrevista será adaptativa, no un formulario fijo.
