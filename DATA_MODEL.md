# Data Model — Technical Foundation Builder

## 1. Principio general

PostgreSQL será la fuente principal de datos. La plataforma requiere relaciones fuertes, versionado, auditoría, trazabilidad y consultas cruzadas, por lo que una base relacional es la opción inicial recomendada.

## 2. Tablas iniciales

### organizations

- id uuid primary key
- name text not null
- owner_user_id uuid not null
- plan text not null default 'free'
- created_at timestamptz not null
- updated_at timestamptz not null

### organization_members

- id uuid primary key
- organization_id uuid not null
- user_id uuid not null
- role text not null
- created_at timestamptz not null

Roles iniciales:

- owner
- admin
- member
- viewer

### projects

- id uuid primary key
- organization_id uuid not null
- name text not null
- description text
- industry text
- product_type text
- status text not null
- technical_level text
- created_by uuid not null
- created_at timestamptz not null
- updated_at timestamptz not null

### interview_sessions

- id uuid primary key
- project_id uuid not null
- status text not null
- current_stage text
- completion_percentage numeric default 0
- created_at timestamptz not null
- updated_at timestamptz not null

### interview_questions

- id uuid primary key
- project_id uuid not null
- session_id uuid
- stage text not null
- question_text text not null
- reason text
- priority integer default 0
- status text not null
- created_at timestamptz not null

### interview_answers

- id uuid primary key
- project_id uuid not null
- question_id uuid
- content text not null
- source text not null
- created_at timestamptz not null

### requirements

- id uuid primary key
- project_id uuid not null
- title text not null
- description text
- type text not null
- priority text
- status text not null
- source text
- confidence numeric
- created_at timestamptz not null
- updated_at timestamptz not null

Tipos:

- functional
- non_functional
- security
- operational
- integration
- reporting

### business_rules

- id uuid primary key
- project_id uuid not null
- statement text not null
- severity text
- status text not null
- source text
- created_at timestamptz not null

### domain_entities

- id uuid primary key
- project_id uuid not null
- name text not null
- description text
- attributes jsonb default []
- relationships jsonb default []
- lifecycle jsonb default {}
- created_at timestamptz not null
- updated_at timestamptz not null

### assumptions

- id uuid primary key
- project_id uuid not null
- statement text not null
- impact text
- status text not null
- source text
- needs_confirmation boolean default true
- created_at timestamptz not null
- updated_at timestamptz not null

### decisions

- id uuid primary key
- project_id uuid not null
- title text not null
- context text
- decision text
- status text not null
- approved_by uuid
- approved_at timestamptz
- created_at timestamptz not null
- updated_at timestamptz not null

### risks

- id uuid primary key
- project_id uuid not null
- title text not null
- description text
- probability text
- impact text
- mitigation text
- owner text
- status text not null
- created_at timestamptz not null

### artifacts

- id uuid primary key
- project_id uuid not null
- type text not null
- title text not null
- status text not null
- current_version_id uuid
- created_at timestamptz not null
- updated_at timestamptz not null

### artifact_versions

- id uuid primary key
- artifact_id uuid not null
- version_number integer not null
- content text not null
- content_format text not null
- source_snapshot jsonb
- generated_by text
- created_at timestamptz not null

### backlog_items

- id uuid primary key
- project_id uuid not null
- title text not null
- description text
- type text not null
- priority text
- status text not null
- estimate text
- created_at timestamptz not null
- updated_at timestamptz not null

### acceptance_criteria

- id uuid primary key
- backlog_item_id uuid not null
- criterion text not null
- created_at timestamptz not null

### readiness_scores

- id uuid primary key
- project_id uuid not null
- overall_score numeric not null
- product_score numeric
- domain_score numeric
- architecture_score numeric
- data_score numeric
- security_score numeric
- testing_score numeric
- delivery_score numeric
- details jsonb
- created_at timestamptz not null

### agent_runs

- id uuid primary key
- project_id uuid
- agent_name text not null
- task_type text not null
- status text not null
- input_summary text
- output_summary text
- metadata jsonb
- created_at timestamptz not null
- completed_at timestamptz

### audit_logs

- id uuid primary key
- organization_id uuid
- project_id uuid
- user_id uuid
- action text not null
- target_type text
- target_id uuid
- metadata jsonb
- created_at timestamptz not null

## 3. Seguridad por datos

Todas las tablas de proyecto deben incluir project_id o organization_id para aplicar Row Level Security.

## 4. Versionado

Los documentos no se sobreescriben sin historial. Cada generación crea una versión.

## 5. Estados estándar

### Confirmación

- confirmed
- assumed
- proposed
- unresolved
- rejected
- deprecated

### Artefactos

- draft
- generated
- reviewed
- approved
- outdated

### Proyectos

- draft
- interviewing
- review
- package_generated
- exported
- archived

## Project Model version history

`project_model_versions` is an immutable snapshot table created by migration 0008.

Important fields:

- `project_model_id`
- `project_id`
- `version_number`
- model JSON collections
- `source_run_id`
- `source_review_id`
- `restored_from_version_id`
- `change_reason`
- `created_by`
- `created_at`

The active state remains in `project_models`. Every relevant insert or update creates a new immutable version through `capture_project_model_version`.

## Project Model Governance v5

### project_model_change_sets

Represents a governed proposal originating from an AI run or a manual edit.

Important fields:

- `project_id`
- `source_type`
- `source_run_id`
- `source_review_id`
- `base_model_version_id`
- `resulting_model_version_id`
- `status`
- change counts
- `application_summary`
- actor and timestamps

### project_model_changes

Represents one reviewable operation against a Project Model collection or its general status.

Important fields:

- `change_set_id`
- `category`
- `operation`
- `entity_key`
- `before_value`
- `after_value`
- `decision`
- reviewer metadata
- `impacted_artifact_types`

### project_artifact_states

Tracks whether a generated artifact is current and the Project Model version on which it is based.

### project_model_versions

Governance v5 adds `source_change_set_id`, linking every governed model version to the proposal that produced it.

## Consistency Engine v6

### consistency_scans

Immutable metadata for deterministic and AI-assisted scans, including source run, Project Model version, structured summary and severity counts.

### consistency_findings

Deduplicated current state keyed by `project_id + fingerprint`. It stores the latest evidence, severity, category, recommendation, lifecycle status, occurrence count and review metadata.

### consistency_scan_findings

Immutable many-to-many snapshot linking each scan to the exact finding content observed at that time.

### consistency_finding_events

Append-only lifecycle audit for creation, recurrence, automatic reopening and human status changes.

A resolved finding is reopened when the same fingerprint appears in a later scan. Scan snapshots remain immutable.

## Readiness Dashboard v7

### readiness_assessments

Immutable assessment header containing:

- project and optional source agent run;
- Project Model version provenance;
- overall score and readiness level;
- summary and optional AI confidence;
- blocker counts by priority;
- evidence snapshot;
- creator and timestamp.

### readiness_dimension_scores

Exactly eight immutable rows per assessment, one for each readiness dimension. Each row stores score, rationale, evidence and gaps.

### readiness_blockers

Assessment-specific blockers with dimension, priority, evidence and a governed lifecycle: `open`, `accepted`, `resolved` or `dismissed`.

### readiness_actions

Assessment-specific next actions with suggested owner, expected outcome, priority and lifecycle: `pending`, `in_progress`, `completed` or `dismissed`.

### readiness_review_events

Append-only audit events for blocker and action state transitions.

AI assessments use a partial unique index on `source_run_id`, guaranteeing that one Readiness Assessor execution cannot be imported more than once.

## Adaptive Interview v8

- `interview_question_batches`: snapshot del diagnóstico determinista o de IA.
- `interview_questions`: catálogo gobernado por proyecto y sesión.
- `interview_question_events`: auditoría inmutable de cambios de estado y respuestas.

`interview_answers.question_id` continúa usando identificadores estables; las preguntas adaptativas generan IDs derivados de su fingerprint.

## Collaboration and Teams v9

### organization_members

Adds:

- normalized `email` for team display and invitation conflict checks;
- `invited_by` provenance;
- `updated_at` lifecycle tracking.

### organization_invitations

Stores organization, normalized invited email, role, SHA-256 token hash, lifecycle status, inviter, accepter, expiry and timestamps. A partial unique index permits only one pending invitation per organization and email.

### organization_membership_events

Append-only audit for invitation creation, revocation, expiry and acceptance; member addition, role changes, removal and voluntary exit; and ownership transfer.

The event row preserves subject email, role transition and optional metadata even when the membership or invitation is later removed.
