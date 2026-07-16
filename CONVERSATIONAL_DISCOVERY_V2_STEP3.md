# Conversational Discovery V2 — Step 3

## Objetivo

Conectar la persistencia gobernada del Step 2 con una experiencia conversacional utilizable. El cliente explica su visión en lenguaje natural; el sistema razona técnicamente, formula una sola pregunta comprensible por turno y persiste evidencia estructurada y trazable.

## Principio rector

El cliente no debe escoger tecnologías ni comprender términos de ingeniería. El agente traduce necesidades técnicas en preguntas sobre actores, situaciones, reglas, excepciones, consecuencias, datos, aprobaciones y resultados observables.

## Flujo implementado

1. La ruta `/projects/[projectId]/discovery` carga el contexto gobernado mediante `get_discovery_runtime_context`.
2. La Server Action recibe el mensaje y un `clientMessageId` idempotente.
3. `runConversationalDiscovery` inicia el turno mediante `start_discovery_turn`.
4. El orquestador obtiene el contexto persistido y reserva un `agent_run` con `discovery.v2`.
5. El snapshot vincula obligatoriamente `discoverySessionId`, `turnId` y `userMessageId`.
6. `Technical Discovery Analyst` produce una salida validada por Zod.
7. La ejecución se completa mediante `complete_agent_run`.
8. PostgreSQL valida y registra la salida mediante `record_discovery_agent_output`.
9. Ante fallos se registran tanto `fail_agent_run` como `fail_discovery_turn`.

## Componentes

- `services/discovery/run-conversational-discovery.ts`: orquestación transaccional de aplicación.
- `services/discovery/build-discovery-agent-input.ts`: contexto e instrucciones del turno.
- `services/discovery/discovery-runtime-context.ts`: contrato de lectura del contexto persistido.
- `app/projects/[projectId]/discovery/*`: primera interfaz conversacional.
- Registro del agente `discovery` en el catálogo y factory existentes.

## Límites deliberados

- No hay streaming en este hito: la persistencia gobernada se completa antes de mostrar la respuesta.
- No se permite escritura directa del agente sobre tablas de Discovery.
- La base de datos sigue siendo autoridad sobre cobertura, readiness, concurrencia y finalización.
- La revisión humana de conocimiento, gaps y contradicciones permanece separada de la conversación.

## Criterios de aceptación

- Un mensaje duplicado conserva idempotencia.
- Cada ejecución queda ligada al turno y mensaje exactos.
- La salida cumple `discovery.v2` antes de persistirse.
- Un fallo libera el turno activo y deja auditoría.
- El cliente recibe preguntas comprensibles y no decisiones de stack.
- Lint, TypeScript, tests y build permanecen en verde.
