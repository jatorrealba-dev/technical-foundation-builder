# Backlog — Technical Foundation Builder

## Épica 1: Foundation técnica

### TFB-001 — Crear repositorio Next.js

Objetivo: Inicializar aplicación Next.js con TypeScript.

Criterios:

- Proyecto Next.js creado.
- TypeScript activo.
- Tailwind configurado.
- Estructura base creada.
- Lint funcionando.

### TFB-002 — Configurar Supabase

Objetivo: Crear conexión a Supabase.

Criterios:

- Variables de entorno documentadas.
- Cliente de Supabase configurado.
- Migraciones iniciales disponibles.
- Conexión validada.

### TFB-003 — Configurar autenticación

Objetivo: Permitir registro y login.

Criterios:

- Registro con email.
- Login con email.
- Logout.
- Rutas protegidas.

### TFB-004 — Crear modelo Organization

Objetivo: Permitir crear una organización inicial.

Criterios:

- Tabla organizations.
- Tabla organization_members.
- Owner asignado.
- RLS básico.

## Épica 2: Proyectos

### TFB-005 — Crear proyecto

Objetivo: El usuario puede crear un proyecto.

Criterios:

- Formulario de creación.
- Tabla projects.
- Proyecto asociado a organización.
- Validación de permisos.

### TFB-006 — Dashboard de proyecto

Objetivo: Mostrar estado del proyecto.

Criterios:

- Datos principales.
- Estado de entrevista.
- Readiness parcial.
- Acceso a documentos.

## Épica 3: Entrevista

### TFB-007 — Crear sesión de entrevista

Objetivo: Iniciar una entrevista para un proyecto.

Criterios:

- Tabla interview_sessions.
- Estado inicial.
- Etapa actual.

### TFB-008 — Guardar respuestas

Objetivo: Permitir responder preguntas.

Criterios:

- Tabla interview_answers.
- Respuesta asociada a pregunta.
- Historial visible.

### TFB-009 — Generar preguntas iniciales con IA

Objetivo: Crear preguntas según descripción del proyecto.

Criterios:

- Prompt controlado.
- Salida estructurada.
- Preguntas guardadas.
- Razón de cada pregunta.

## Épica 4: Project Model

### TFB-010 — Extraer requisitos

Objetivo: Convertir respuestas en requisitos estructurados.

Criterios:

- Tabla requirements.
- Estados confirmed/assumed/unresolved.
- Fuente rastreable.

### TFB-011 — Extraer entidades de dominio

Objetivo: Identificar entidades principales.

Criterios:

- Tabla domain_entities.
- Atributos en JSON.
- Relaciones iniciales.

### TFB-012 — Extraer supuestos

Objetivo: Detectar supuestos no confirmados.

Criterios:

- Tabla assumptions.
- Necesita confirmación.
- Impacto asignado.

## Épica 5: Documentos

### TFB-013 — Generar Product Spec

Objetivo: Generar PRODUCT_SPEC.md desde el Project Model.

Criterios:

- Artifact creado.
- ArtifactVersion creado.
- Contenido en Markdown.
- Supuestos marcados.

### TFB-014 — Generar paquete inicial

Objetivo: Generar ocho documentos MVP.

Criterios:

- Product Spec.
- MVP Scope.
- Domain Model.
- Architecture.
- Data Model.
- Security.
- Backlog.
- Vertical Slice Plan.

## Épica 6: Validación

### TFB-015 — Readiness Score inicial

Objetivo: Calcular score por categorías.

Criterios:

- Score general.
- Score por área.
- Razones visibles.
- Preguntas pendientes afectan score.

### TFB-016 — Detección básica de contradicciones

Objetivo: Marcar conflictos simples.

Criterios:

- Conflictos guardados.
- Usuario puede verlos.
- Documentos afectados identificados.

## Épica 7: Exportación

### TFB-017 — Exportar Markdown

Objetivo: Descargar documentos Markdown.

Criterios:

- Archivos .md generados.
- Nombres consistentes.
- Permisos validados.

### TFB-018 — Exportar ZIP

Objetivo: Descargar paquete completo.

Criterios:

- ZIP con documentos.
- Metadata incluida.
- Auditoría de exportación.

### TFB-019 — Exportar PDF

Objetivo: Generar PDF ejecutivo.

Criterios:

- PDF renderizado.
- Formato legible.
- Contenido actualizado.
