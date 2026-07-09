# Test Strategy — Technical Foundation Builder

## 1. Objetivo

Garantizar que la plataforma pueda recopilar información, estructurarla, generar documentos y proteger datos de organizaciones distintas sin regresiones críticas.

## 2. Tipos de pruebas

### Unit tests

Para Project Model Service, Readiness Engine, Consistency Engine, Artifact Generator, validadores de schemas y helpers de permisos.

### Integration tests

Para crear proyecto, guardar entrevista, extraer requisitos, generar documentos, exportar paquete y probar RLS.

### End-to-end tests

Flujo MVP:

1. Usuario se registra.
2. Crea organización.
3. Crea proyecto.
4. Describe idea.
5. Responde entrevista.
6. Genera Product Spec.
7. Exporta paquete.

### Security tests

Casos críticos:

- Usuario A no puede leer proyectos de organización B.
- Viewer no puede editar proyecto.
- Member no puede cambiar permisos de organización.
- URL privada no puede descargarse sin permiso.
- Exportación requiere autorización.

### AI output tests

Validar que:

- Respuestas estructuradas cumplen schema.
- Supuestos se marcan correctamente.
- Preguntas críticas faltantes se detectan.
- Documentos no omiten información confirmada.
- Contradicciones simples son detectadas.

## 3. Herramientas sugeridas

- Vitest.
- Testing Library.
- Playwright.
- Supabase local.
- Zod para validación.
- GitHub Actions.

## 4. Pruebas mínimas del MVP

- Crear proyecto.
- Crear entrevista.
- Guardar respuesta.
- Extraer requisito.
- Generar Product Spec.
- Calcular readiness.
- Exportar Markdown.
- Validar aislamiento de organización.

## 5. Definition of test complete

Una funcionalidad está probada cuando:

- Tiene pruebas unitarias si contiene lógica.
- Tiene prueba de integración si toca base de datos.
- Tiene prueba E2E si pertenece al flujo crítico.
- Tiene prueba de permisos si expone datos.
- Pasa en CI.
