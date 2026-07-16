# Validation v10

## Resultado local

- ESLint: aprobado.
- TypeScript: aprobado.
- Pruebas automatizadas: 33 aprobadas, 0 fallidas.
- Next.js production build: aprobado.
- Rutas nuevas presentes en el build.
- Migración PostgreSQL: 60 sentencias parseadas con `pglast`.
- Health liveness: `200 OK` con encabezados de seguridad.
- Health readiness sin entorno: `503`, comportamiento esperado.
- `npm audit --audit-level=high`: aprobado; permanecen dos avisos moderados transitivos de PostCSS en Next.js.
- Dependencias nuevas: ninguna.
- Secretos incluidos: ninguno.

## Validación conectada pendiente

- Aplicar `0014_production_hardening.sql`.
- Verificar `/api/health/ready` contra Supabase remoto.
- Guardar una política de IA como owner/admin.
- Confirmar que member solo puede leerla.
- Probar bloqueo concurrente.
- Probar límite diario.
- Probar recuperación de una ejecución estancada.
- Ejecutar un agente y confirmar el mismo correlation ID en interfaz, base y log JSON.
