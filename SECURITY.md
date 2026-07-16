# Security — Technical Foundation Builder

## 1. Principios

- Seguridad por diseño.
- Multi-tenancy desde el primer día.
- Separación entre organizaciones.
- Row Level Security obligatoria.
- Mínimo privilegio.
- Auditoría de acciones críticas.
- No guardar secretos en el cliente.
- No tratar suposiciones como decisiones aprobadas.
- Protección de datos del proyecto del usuario.

## 2. Autenticación

MVP:

- Supabase Auth.
- Email y contraseña.
- Sesión persistente.
- Recuperación de contraseña en fase posterior.

## 3. Autorización

Modelo inicial:

```text
Organization
└── Members
    ├── owner
    ├── admin
    ├── member
    └── viewer
```

### owner

Puede administrar organización, crear proyectos, editar proyectos, generar documentos, exportar paquetes y eliminar proyectos.

### admin

Puede crear proyectos, editar proyectos, generar documentos y exportar paquetes.

### member

Puede ver proyectos asignados, participar en entrevistas y editar información del proyecto si tiene permiso.

### viewer

Puede leer proyectos y descargar artefactos aprobados si tiene permiso.

## 4. Row Level Security

Cada tabla sensible debe aplicar RLS.

Regla general:

Un usuario solo puede leer o modificar datos si pertenece a la organización propietaria del registro.

## 5. Datos sensibles

La plataforma puede recibir ideas de negocio, arquitectura de productos, modelos de negocio, información técnica confidencial y potenciales secretos escritos por error.

Por tanto:

- Se debe advertir al usuario que no incluya claves privadas.
- Se deben filtrar patrones evidentes de secretos.
- Los logs no deben guardar respuestas completas sensibles innecesariamente.
- Los exports deben respetar permisos.

## 6. IA y seguridad

La IA no debe:

- Aprobar decisiones críticas automáticamente.
- Inventar requisitos como hechos.
- Ocultar incertidumbre.
- Generar recomendaciones de cumplimiento legal como garantía.
- Acceder a proyectos de otras organizaciones.
- Reutilizar datos de un proyecto en otro.

## 7. Auditoría

Acciones auditadas:

- Crear organización.
- Crear proyecto.
- Editar proyecto.
- Generar artefacto.
- Aprobar decisión.
- Exportar paquete.
- Cambiar permisos.
- Eliminar proyecto.

## 8. Amenazas iniciales

### Acceso cruzado entre organizaciones

Mitigación:

- RLS en todas las tablas.
- organization_id obligatorio.
- Pruebas de aislamiento.

### Exposición accidental de documentos

Mitigación:

- Storage privado.
- URLs firmadas con expiración.
- Validación de permisos antes de descargar.

### Suplantación por prompt injection

Mitigación:

- No ejecutar instrucciones del contenido del usuario como instrucciones del sistema.
- Separar datos de instrucciones.
- Salidas estructuradas validadas.

### Generación de documentación errónea

Mitigación:

- Clasificar suposiciones.
- Requerir aprobación humana.
- Mostrar preguntas pendientes.
- Score de preparación.

## 9. Requisitos de seguridad del MVP

- RLS activo.
- Auth obligatorio para proyectos.
- Storage privado.
- Variables secretas solo en servidor.
- Auditoría básica.
- Revisión de permisos antes de exportar.

## AI governance hardening

Migration 0008 enforces review application at three layers:

- UI controls are visible only to organization owners and admins.
- Server Actions revalidate authenticated role and resource ownership.
- Security-definer RPC functions verify `is_org_admin`, lock the review row, and validate all payloads.

Members retain read access through RLS but do not receive write privileges for Project Model history. Direct writes to `project_model_versions` are not granted to authenticated users.

## Project Model Governance v5 security

Governance tables expose read-only RLS access to organization members. Authenticated users receive no direct write privileges.

All state transitions use security-definer RPC functions that:

- require an authenticated user;
- resolve the owning organization from the project;
- require `is_org_admin`;
- lock mutable governance rows before applying;
- reject pending, closed or duplicate applications;
- validate model and artifact payload shape;
- validate the artifact-impact set against accepted changes.

The legacy `apply_approved_project_model_run` execute privilege is revoked from `authenticated`, preventing bypass of granular review through the v4 application endpoint.

## Consistency Engine v6 security

Consistency tables grant authenticated users read-only access through project-membership RLS. Direct writes are revoked.

`record_consistency_scan` validates:

- authenticated project membership;
- deterministic versus agent source consistency;
- completed Consistency Reviewer source run;
- approved human review before AI import;
- unique source-run import;
- allowed severities, categories and artifact types;
- unique fingerprints inside each payload.

`review_consistency_finding` additionally requires organization `owner` or `admin` authorization. All status changes create append-only audit events.

## Readiness Dashboard v7 security

Readiness tables expose read-only RLS access to authenticated members of the owning organization. Direct authenticated inserts, updates and deletes are revoked.

`record_readiness_assessment` validates:

- authenticated project membership;
- deterministic versus agent source consistency;
- Project Model version ownership;
- score, level and confidence ranges;
- exactly eight unique dimension keys;
- blocker and action payload structure;
- completed Readiness Assessor source run;
- approved human review before AI import;
- one-time source-run import.

`review_readiness_blocker` and `review_readiness_action` require organization owner/admin authorization and row locks. Every lifecycle transition is written to `readiness_review_events`.

Readiness scores are explicitly advisory and must not be treated as automated security approval or production authorization.

## Controles de Adaptive Interview v8

Las tablas adaptativas tienen RLS de lectura por membresía y revocación de escrituras directas. Las respuestas, lotes y transiciones pasan por RPC protegidos. Marcar una pregunta como obsoleta requiere `owner` o `admin`. La importación de IA requiere ejecución completada y revisión aprobada.

## Collaboration security v9

- Raw invitation tokens are never persisted.
- Tokens contain 32 random bytes before hexadecimal encoding.
- Acceptance requires the authenticated Supabase email to match the normalized invited email.
- Invitations are single-use, expiring and revocable; terminal transitions rotate the stored hash so the original link no longer resolves.
- Direct admin mutations of organization memberships are removed; governed RPCs enforce role hierarchy and row locking.
- Admins cannot invite, alter or remove other admins.
- Ownership cannot be deleted and must be transferred explicitly.
- Authentication return paths accept only internal absolute paths beginning with a single `/`.
- Membership and invitation lifecycle changes are auditable.

The invitation link is a bearer secret until accepted or revoked. It must be shared through a trusted channel. Automated email delivery, domain allowlists and enterprise identity provisioning are future controls.

## Production hardening controls v10

- Direct authenticated inserts and updates to `agent_runs` are revoked.
- `reserve_agent_run` validates membership and enforces organization policy atomically.
- `complete_agent_run` and `fail_agent_run` require the authenticated run creator and lock the row.
- Correlation IDs link application logs with persisted executions without exposing prompts or secrets.
- Stored operational errors are redacted and capped in length.
- AI policy changes and stale-run recovery require `owner` or `admin`.
- Security headers include CSP, frame denial, MIME sniffing protection, restrictive referrer policy and browser capability restrictions.
- Health responses expose no API keys, tokens or connection strings.

The timeout is a persistence and workflow control. Provider-side cancellation is not guaranteed after a network request has already been transmitted, so token budgets must include operational headroom.
