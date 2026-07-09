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
