# Domain Model — Technical Foundation Builder

## 1. Entidades principales

### Organization

Agrupa usuarios, proyectos y configuración de cuenta.

Campos conceptuales:

- organizationId
- name
- ownerUserId
- plan
- createdAt
- updatedAt

### User

Persona que utiliza la plataforma.

Campos:

- userId
- email
- name
- createdAt
- lastLoginAt

### Project

Representa una idea o sistema que será estructurado.

Campos:

- projectId
- organizationId
- name
- description
- industry
- productType
- status
- technicalLevel
- createdBy
- createdAt
- updatedAt

### InterviewSession

Sesión de descubrimiento asociada a un proyecto.

### InterviewQuestion

Pregunta generada o predefinida para recopilar información.

### InterviewAnswer

Respuesta dada por el usuario.

### Requirement

Necesidad funcional o no funcional extraída del proyecto.

### BusinessRule

Regla que limita o define el comportamiento del sistema.

### DomainEntity

Objeto relevante del negocio del proyecto del usuario.

### Assumption

Suposición detectada por la IA o por el sistema.

### Decision

Decisión tomada o propuesta.

### Risk

Riesgo técnico, de producto, negocio o entrega.

### Artifact

Documento generado.

### ArtifactVersion

Versión de un documento generado.

### BacklogItem

Trabajo implementable derivado del proyecto.

## 2. Estados principales

### Project status

- draft
- interviewing
- ready_for_review
- package_generated
- exported
- archived

### Requirement status

- proposed
- confirmed
- unresolved
- rejected
- deprecated

### Assumption status

- open
- confirmed
- rejected
- converted_to_requirement

### Artifact status

- draft
- generated
- reviewed
- approved
- outdated

## 3. Reglas de dominio

- Un proyecto pertenece a una organización.
- Una entrevista pertenece a un proyecto.
- Una respuesta pertenece a una pregunta.
- Un requisito debe rastrearse hasta una fuente.
- Una decisión crítica requiere aprobación humana.
- Un documento generado debe apuntar a una versión del Project Model.
- Una suposición no confirmada debe aparecer marcada en los documentos.
- Un Readiness Score no puede ser 100% si existen preguntas críticas sin resolver.

## 4. Eventos de dominio

- ProjectCreated
- InterviewStarted
- QuestionGenerated
- AnswerSubmitted
- RequirementExtracted
- AssumptionDetected
- ConflictDetected
- DecisionApproved
- ArtifactGenerated
- ReadinessScoreCalculated
- PackageExported
