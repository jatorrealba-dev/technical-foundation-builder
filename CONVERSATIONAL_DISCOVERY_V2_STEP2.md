# Conversational Discovery v2 — Paso 2

## Alcance

Este paso agrega persistencia, RLS, idempotencia, concurrencia y RPC gobernadas para `discovery.v2`. No agrega todavía la ruta de chat ni ejecuta OpenAI.

## Migración

```text
supabase/migrations/0015_conversational_discovery_v2.sql
```

Crea:

- `discovery_sessions`
- `discovery_messages`
- `discovery_knowledge`
- `discovery_gaps`
- `discovery_contradictions`
- `discovery_coverage`
- `discovery_artifact_readiness`
- `discovery_events`

## Modelo de seguridad

Los miembros autenticados pueden leer los registros de su organización mediante RLS. Las tablas no conceden `insert`, `update` ni `delete` a `authenticated`. Las mutaciones pasan por funciones `security definer` que vuelven a comprobar autenticación, membresía, rol y relación con el proyecto.

Las decisiones administrativas —resolver gaps, resolver contradicciones, completar o reabrir una sesión— requieren `owner` o `admin`.

Un `member` solo puede confirmar o rechazar conocimiento cuando todas las fuentes de ese conocimiento son mensajes creados por ese mismo usuario.

## Flujo transaccional futuro

```text
start_discovery_turn
→ reserve_agent_run(agent_key=discovery, prompt=discovery.v2)
→ proveedor de IA
→ complete_agent_run
→ record_discovery_agent_output
```

Si falla el proveedor:

```text
fail_agent_run
→ fail_discovery_turn
```

`client_message_id` hace idempotente el envío. `active_turn_id`, `FOR UPDATE` y `lock_version` impiden dos turnos simultáneos.

## Readiness documental

La salida del agente conserva su `agent_status`, pero la base recalcula el estado efectivo de los ocho documentos usando cobertura vigente y gaps/contradicciones abiertas. La finalización tampoco confía en la recomendación del agente.


## Endurecimiento posterior a revisión

La migración valida en PostgreSQL el mismo contrato de cobertura definido por `discovery.v2`:

- Cada dimensión debe clasificar todos sus criterios exactamente una vez.
- Un criterio satisfecho requiere evidencia trazable a mensajes de usuario.
- `complete`, `partial`, `missing` y `not_applicable` se validan independientemente del agente.
- Solo `roles` e `integrations` pueden quedar completamente como no aplicables.
- La readiness efectiva mantiene alineación con el dominio: evidencia parcial o gaps altos producen `usable`; cobertura faltante o gaps críticos producen `blocked`.
- Una ejecución de discovery debe quedar vinculada a `sessionId`, `turnId` y `userMessageId` mediante su `input_snapshot`.
- El turno límite se registra, pero no dispara una nueva ejecución de IA.
- Conocimiento y decisiones ya revisadas no pueden ser reescritos silenciosamente por una salida posterior.

## Aplicación

Antes de aplicar:

```bash
npm run check
npx supabase migration list
```

La base remota debe terminar en `0014`. Después:

```bash
npx supabase db push
```

Debe ofrecer únicamente:

```text
0015_conversational_discovery_v2.sql
```

Después de aplicar, ejecutar en SQL Editor:

```text
supabase/tests/0015_conversational_discovery_v2_verification.sql
```

## Fuera de alcance

- Interfaz conversacional.
- Server Action que llama al proveedor.
- Normalización runtime del resultado.
- Integración con Project Model y documentos.
- Prueba conectada con una conversación real.
