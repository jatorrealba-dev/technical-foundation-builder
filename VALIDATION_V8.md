# Validation v8

## Automatización

- ESLint: aprobado.
- TypeScript: aprobado.
- Node test runner: 24 pruebas aprobadas.
- Next.js production build: aprobado.
- Ruta adaptativa `/projects/[projectId]/interview`: incluida.
- Sin dependencias nuevas.
- Sin secretos incluidos en la entrega.

## Pruebas nuevas

- Fingerprints estables ante acentos y puntuación.
- Detección de preguntas semánticamente equivalentes.
- Generación determinista desde evidencia existente.
- Exclusión de preguntas duplicadas.
- Normalización de `Interview Strategist v2` con metadata de gobernanza.

## Validación conectada pendiente

Después de aplicar `0012_adaptive_interview.sql`:

1. abrir la entrevista;
2. confirmar backfill de siete preguntas base;
3. guardar o editar una respuesta;
4. ejecutar la generación determinista;
5. posponer y reabrir una pregunta;
6. ejecutar y aprobar `Interview Strategist v2`;
7. importar la ejecución;
8. confirmar que una segunda importación no duplica preguntas;
9. generar el Project Model y verificar trazabilidad de respuestas adaptativas.
