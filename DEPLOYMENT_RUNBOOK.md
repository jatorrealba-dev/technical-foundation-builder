# Deployment Runbook

## Ambientes

Mantener proyectos Supabase y variables independientes para local, staging y producción.

## Variables obligatorias

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` o `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `AI_AGENTS_ENABLED`
- `OPENAI_API_KEY` cuando IA está habilitada
- `OPENAI_AGENT_MODEL` cuando IA está habilitada
- `AI_AGENT_MAX_TURNS`
- `APP_VERSION`

## Orden de despliegue

1. Ejecutar `npm ci`.
2. Ejecutar `npm run check`.
3. Ejecutar `npm run audit:high`.
4. Aplicar migraciones en staging.
5. Verificar `/api/health` y `/api/health/ready`.
6. Probar una reserva de agente y una restricción de concurrencia.
7. Promover el mismo commit a producción.
8. Aplicar migraciones de producción.
9. Repetir health checks y smoke tests.

## Rollback

No borrar migraciones aplicadas. Revertir la aplicación al commit anterior y crear una migración compensatoria cuando un cambio de esquema deba deshacerse.

## Respuesta operacional

Ante ejecuciones estancadas, usar **Operación de IA → Recuperar ejecuciones estancadas**. El sistema conserva el historial y registra `run_recovered`.
