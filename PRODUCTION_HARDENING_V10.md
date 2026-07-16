# Production Hardening v10

## Objetivo

Convertir la ejecución de agentes en una operación gobernada, observable y recuperable antes de conectar staging o producción.

## Controles implementados

- Reserva atómica de ejecuciones antes de llamar al proveedor.
- Presupuesto mensual de tokens por organización.
- Límite diario de ejecuciones por usuario.
- Límites de concurrencia por usuario y por agente/proyecto.
- Timeout configurable entre 30 y 900 segundos.
- Recuperación de ejecuciones estancadas.
- Correlation ID persistido y emitido en logs JSON.
- Errores operativos sanitizados y clasificados.
- Finalización y fallo mediante RPC transaccionales.
- Health checks de liveness y readiness.
- Encabezados HTTP de seguridad.
- Auditoría de dependencias altas/críticas en CI.

## Rutas

- `/organizations/[organizationId]/settings/ai`
- `/api/health`
- `/api/health/ready`

## Política predeterminada

- IA habilitada.
- 20 ejecuciones diarias por usuario.
- 1,000,000 tokens mensuales por organización.
- Una ejecución concurrente por usuario.
- Una ejecución concurrente del mismo agente por proyecto.
- Timeout de 180 segundos.

## Semántica del timeout

El timeout cierra la reserva y evita que una respuesta tardía modifique el estado persistido. La cancelación física de una solicitud ya enviada depende de las capacidades del proveedor y del runtime de despliegue; por ello, los presupuestos deben mantener margen operacional.
