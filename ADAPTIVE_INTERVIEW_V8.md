# Adaptive Interview v8

## Objetivo

Convertir la entrevista inicial estática en un sistema adaptativo, persistente y gobernado que conserve trazabilidad de cada pregunta, evite repeticiones y permita incorporar recomendaciones aprobadas de `Interview Strategist`.

## Flujo

```text
Preguntas base
→ respuestas persistidas
→ diagnóstico determinista o Interview Strategist
→ deduplicación por fingerprint y similitud semántica
→ preguntas adaptativas gobernadas
→ responder, omitir, posponer o declarar obsoleta
→ Project Model con evidencia adicional
```

## Preguntas gobernadas

Cada pregunta conserva:

- etapa;
- prioridad;
- origen (`base`, `deterministic`, `agent`, `manual`);
- estado (`pending`, `answered`, `skipped`, `deferred`, `obsolete`);
- motivo;
- helper text;
- artefactos afectados;
- área de riesgo;
- obligatoriedad;
- ejecución de IA de origen;
- comentario de revisión;
- eventos de auditoría.

## Motor determinista

El motor local propone seguimientos sobre:

- roles y autorización;
- workflow y lifecycle;
- retención y propiedad de datos;
- autenticación;
- integraciones y fallos;
- observabilidad y recuperación;
- criterios de éxito del MVP.

No consume OpenAI. Las preguntas equivalentes se descartan antes de persistirse.

## Interview Strategist v2

`interview.v2` devuelve preguntas con metadata de gobernanza:

- `helperText`;
- `reason`;
- `priority`;
- `affectsArtifacts`;
- `riskArea`;
- `required`.

Solo se importan ejecuciones:

1. completadas;
2. correspondientes a `interview`;
3. aprobadas por revisión humana;
4. no importadas anteriormente.

## Integración con Project Model

Las respuestas adaptativas se convierten en requisitos confirmados según su etapa. Las preguntas obligatorias o de prioridad alta que continúan pendientes se incorporan como preguntas abiertas del Project Model.

## Seguridad y concurrencia

Las tablas nuevas son de lectura para miembros y no permiten escrituras directas autenticadas. Las mutaciones pasan por RPC `security definer` que verifican membresía, rol y consistencia del estado.

## Migración

```text
0012_adaptive_interview.sql
```

Crea:

- `interview_question_batches`;
- `interview_questions`;
- `interview_question_events`.

RPC:

- `ensure_adaptive_interview`;
- `record_interview_question_batch`;
- `save_adaptive_interview_answer`;
- `set_interview_question_status`.
