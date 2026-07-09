# Product Spec — Technical Foundation Builder

## 1. Resumen

Technical Foundation Builder es una plataforma web que ayuda a una persona a transformar una idea de software en un paquete técnico profesional. La plataforma realiza una entrevista adaptativa, extrae requisitos, detecta supuestos, identifica riesgos y genera documentos técnicos y de planificación para iniciar el desarrollo.

## 2. Problema del usuario

El usuario sabe qué quiere construir de forma general, pero no sabe cómo organizarlo técnicamente.

Ejemplo:

> Quiero una app para administrar valet parking.

El problema es que esa frase no define:

- Usuarios.
- Roles.
- Reglas de negocio.
- Modelo de datos.
- Estados.
- Permisos.
- Seguridad.
- Arquitectura.
- Backlog.
- Criterios de aceptación.
- Primer vertical slice.

## 3. Resultado esperado

La plataforma debe producir un paquete descargable que pueda entregarse a:

- Un equipo de desarrollo.
- Una agencia.
- Un freelancer.
- Un CTO.
- Codex u otro agente de programación.
- Un inversionista técnico.
- Un equipo interno.

## 4. Flujo principal del usuario

1. Usuario crea cuenta.
2. Usuario crea una organización o espacio de trabajo.
3. Usuario crea un proyecto.
4. Usuario describe su idea en lenguaje natural.
5. Sistema clasifica el tipo de proyecto.
6. Sistema inicia una entrevista adaptativa.
7. Usuario responde preguntas por etapas.
8. Sistema extrae requisitos, reglas, entidades, riesgos y supuestos.
9. Sistema marca información como: Confirmed, Assumed, Proposed, Unresolved, Rejected.
10. Usuario revisa y aprueba decisiones importantes.
11. Sistema genera documentos.
12. Sistema calcula Readiness Score.
13. Usuario exporta el paquete.

## 5. Módulos funcionales del MVP

### 5.1 Autenticación

El usuario debe poder registrarse e iniciar sesión.

Requisitos:

- Email y contraseña.
- Restauración de sesión.
- Logout.
- Protección de rutas privadas.

### 5.2 Organizaciones

El usuario debe poder trabajar dentro de una organización.

Requisitos:

- Crear organización.
- Ser owner de la organización.
- Ver proyectos de la organización.

### 5.3 Proyectos

El usuario debe poder crear proyectos.

Campos iniciales:

- Nombre.
- Descripción corta.
- Industria.
- Tipo de producto.
- Estado actual.
- Nivel técnico del usuario.
- Objetivo principal.

### 5.4 Entrevista adaptativa

La plataforma debe generar preguntas según:

- Tipo de producto.
- Respuestas previas.
- Información faltante.
- Riesgos detectados.
- Contradicciones.

La entrevista debe dividirse en etapas:

1. Idea.
2. Producto.
3. Usuarios.
4. Dominio.
5. Seguridad.
6. Arquitectura.
7. Entrega.

### 5.5 Project Model

La información recopilada debe guardarse como datos estructurados.

El modelo debe incluir:

- Requisitos.
- Usuarios.
- Personas.
- Reglas de negocio.
- Entidades.
- Estados.
- Eventos.
- Supuestos.
- Decisiones.
- Riesgos.
- Preguntas abiertas.
- Criterios de aceptación.
- Tareas de backlog.

### 5.6 Generación documental

El MVP debe generar:

- PRODUCT_SPEC.md
- MVP_SCOPE.md
- DOMAIN_MODEL.md
- ARCHITECTURE.md
- DATA_MODEL.md
- SECURITY.md
- BACKLOG.md
- VERTICAL_SLICE_PLAN.md

### 5.7 Readiness Score

La plataforma debe calcular qué tan preparado está el proyecto.

Categorías iniciales:

- Producto.
- Dominio.
- Arquitectura.
- Datos.
- Seguridad.
- Pruebas.
- Entrega.

### 5.8 Exportación

El usuario debe poder descargar:

- Markdown.
- PDF.
- ZIP.

## 6. Fuera del MVP

No incluir inicialmente:

- Marketplace de templates.
- Colaboración multiusuario avanzada.
- Comentarios en documentos.
- Integración GitHub.
- Integración Jira/Linear.
- Generación completa de repositorios.
- Generación automática de código de producción.
- Facturación.
- Aplicación móvil.
- Compliance avanzado.
- Diagramas editables complejos.
- Revisión automática de repositorios existentes.

## 7. Reglas clave

- La IA no puede aprobar decisiones críticas automáticamente.
- Toda decisión importante debe indicar si fue confirmada por el usuario o inferida.
- Los documentos deben generarse desde el Project Model, no desde texto suelto.
- Si una respuesta del usuario contradice información previa, debe marcarse conflicto.
- Si falta información crítica, el sistema debe marcarla como pregunta pendiente.
- La exportación debe indicar qué partes son supuestos.

## 8. Criterios de aceptación del MVP

El MVP está aceptado cuando:

- Un usuario puede crear una cuenta y un proyecto.
- El usuario puede describir una idea.
- El sistema genera preguntas adaptativas.
- El usuario puede responder preguntas.
- El sistema extrae requisitos estructurados.
- El sistema genera al menos ocho documentos.
- El sistema muestra supuestos y preguntas abiertas.
- El sistema calcula un readiness score.
- El usuario puede exportar el paquete.
