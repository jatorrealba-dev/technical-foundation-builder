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
