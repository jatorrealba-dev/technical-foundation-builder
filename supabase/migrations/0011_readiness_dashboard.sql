begin;

create table if not exists public.readiness_assessments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null
    references public.projects(id)
    on delete cascade,
  source text not null,
  source_run_id uuid
    references public.agent_runs(id)
    on delete set null,
  project_model_version_id uuid
    references public.project_model_versions(id)
    on delete set null,
  project_model_version_number integer,
  overall_score integer not null,
  level text not null,
  summary text not null,
  confidence numeric(4, 3),
  evidence_snapshot jsonb not null default '{}'::jsonb,
  blocker_count integer not null default 0,
  critical_blocker_count integer not null default 0,
  high_blocker_count integer not null default 0,
  medium_blocker_count integer not null default 0,
  low_blocker_count integer not null default 0,
  created_by uuid
    references auth.users(id)
    on delete set null,
  created_at timestamptz not null default now(),

  constraint readiness_assessments_source_valid
    check (source in ('deterministic', 'agent')),

  constraint readiness_assessments_score_valid
    check (overall_score between 0 and 100),

  constraint readiness_assessments_level_valid
    check (
      level in (
        'not_ready',
        'at_risk',
        'progressing',
        'ready_for_review',
        'ready'
      )
    ),

  constraint readiness_assessments_confidence_valid
    check (
      confidence is null
      or confidence between 0 and 1
    ),

  constraint readiness_assessments_model_version_consistent
    check (
      (project_model_version_id is null and project_model_version_number is null)
      or
      (project_model_version_id is not null and project_model_version_number is not null)
    ),

  constraint readiness_assessments_source_run_consistent
    check (
      (source = 'deterministic' and source_run_id is null)
      or
      (source = 'agent' and source_run_id is not null)
    ),

  constraint readiness_assessments_counts_valid
    check (
      blocker_count >= 0
      and critical_blocker_count >= 0
      and high_blocker_count >= 0
      and medium_blocker_count >= 0
      and low_blocker_count >= 0
      and blocker_count =
        critical_blocker_count +
        high_blocker_count +
        medium_blocker_count +
        low_blocker_count
    )
);

create unique index if not exists
  idx_readiness_assessments_source_run_unique
on public.readiness_assessments (source_run_id)
where source_run_id is not null;

create index if not exists
  idx_readiness_assessments_project_created_at
on public.readiness_assessments (project_id, created_at desc);

create table if not exists public.readiness_dimension_scores (
  assessment_id uuid not null
    references public.readiness_assessments(id)
    on delete cascade,
  dimension_key text not null,
  score integer not null,
  rationale text not null,
  evidence jsonb not null default '[]'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),

  primary key (assessment_id, dimension_key),

  constraint readiness_dimension_scores_key_valid
    check (
      dimension_key in (
        'product',
        'domain',
        'architecture',
        'data',
        'security',
        'testing',
        'delivery',
        'operations'
      )
    ),

  constraint readiness_dimension_scores_score_valid
    check (score between 0 and 100),

  constraint readiness_dimension_scores_evidence_array
    check (jsonb_typeof(evidence) = 'array'),

  constraint readiness_dimension_scores_gaps_array
    check (jsonb_typeof(gaps) = 'array')
);

create table if not exists public.readiness_blockers (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null
    references public.readiness_assessments(id)
    on delete cascade,
  project_id uuid not null
    references public.projects(id)
    on delete cascade,
  fingerprint text not null,
  dimension_key text not null,
  title text not null,
  reason text not null,
  priority text not null,
  evidence jsonb not null default '[]'::jsonb,
  status text not null default 'open',
  review_comment text,
  reviewed_by uuid
    references auth.users(id)
    on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint readiness_blockers_assessment_fingerprint_unique
    unique (assessment_id, fingerprint),

  constraint readiness_blockers_dimension_valid
    check (
      dimension_key in (
        'product',
        'domain',
        'architecture',
        'data',
        'security',
        'testing',
        'delivery',
        'operations'
      )
    ),

  constraint readiness_blockers_priority_valid
    check (priority in ('low', 'medium', 'high', 'critical')),

  constraint readiness_blockers_status_valid
    check (status in ('open', 'accepted', 'resolved', 'dismissed')),

  constraint readiness_blockers_evidence_array
    check (jsonb_typeof(evidence) = 'array'),

  constraint readiness_blockers_review_consistent
    check (
      (status = 'open' and reviewed_by is null and reviewed_at is null)
      or
      (status <> 'open' and reviewed_by is not null and reviewed_at is not null)
    ),

  constraint readiness_blockers_comment_length
    check (review_comment is null or char_length(review_comment) <= 4000)
);

create index if not exists
  idx_readiness_blockers_project_status_priority
on public.readiness_blockers (
  project_id,
  status,
  priority,
  created_at desc
);

create table if not exists public.readiness_actions (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null
    references public.readiness_assessments(id)
    on delete cascade,
  project_id uuid not null
    references public.projects(id)
    on delete cascade,
  fingerprint text not null,
  dimension_key text not null,
  action text not null,
  owner_role text not null,
  expected_outcome text not null,
  priority text not null,
  status text not null default 'pending',
  review_comment text,
  reviewed_by uuid
    references auth.users(id)
    on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint readiness_actions_assessment_fingerprint_unique
    unique (assessment_id, fingerprint),

  constraint readiness_actions_dimension_valid
    check (
      dimension_key in (
        'product',
        'domain',
        'architecture',
        'data',
        'security',
        'testing',
        'delivery',
        'operations'
      )
    ),

  constraint readiness_actions_priority_valid
    check (priority in ('low', 'medium', 'high')),

  constraint readiness_actions_status_valid
    check (status in ('pending', 'in_progress', 'completed', 'dismissed')),

  constraint readiness_actions_review_consistent
    check (
      (status = 'pending' and reviewed_by is null and reviewed_at is null)
      or
      (status <> 'pending' and reviewed_by is not null and reviewed_at is not null)
    ),

  constraint readiness_actions_comment_length
    check (review_comment is null or char_length(review_comment) <= 4000)
);

create index if not exists
  idx_readiness_actions_project_status_priority
on public.readiness_actions (
  project_id,
  status,
  priority,
  created_at desc
);

create table if not exists public.readiness_review_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null
    references public.projects(id)
    on delete cascade,
  assessment_id uuid not null
    references public.readiness_assessments(id)
    on delete cascade,
  item_type text not null,
  item_id uuid not null,
  status_from text,
  status_to text not null,
  comment text,
  actor_id uuid
    references auth.users(id)
    on delete set null,
  created_at timestamptz not null default now(),

  constraint readiness_review_events_item_type_valid
    check (item_type in ('blocker', 'action')),

  constraint readiness_review_events_comment_length
    check (comment is null or char_length(comment) <= 4000)
);

create index if not exists
  idx_readiness_review_events_assessment_created_at
on public.readiness_review_events (assessment_id, created_at desc);

comment on table public.readiness_assessments is
  'Immutable implementation-readiness assessments generated by deterministic rules or an approved Readiness Assessor run.';

comment on table public.readiness_dimension_scores is
  'Immutable evidence, gaps, and scores for the eight readiness dimensions.';

comment on table public.readiness_blockers is
  'Assessment blockers with explicit human review state.';

comment on table public.readiness_actions is
  'Recommended next actions with an operational follow-up state.';

comment on table public.readiness_review_events is
  'Audit trail for blocker and action status transitions.';

alter table public.readiness_assessments enable row level security;
alter table public.readiness_dimension_scores enable row level security;
alter table public.readiness_blockers enable row level security;
alter table public.readiness_actions enable row level security;
alter table public.readiness_review_events enable row level security;

drop policy if exists
  "Members can read readiness assessments"
on public.readiness_assessments;

create policy
  "Members can read readiness assessments"
on public.readiness_assessments
for select
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = readiness_assessments.project_id
      and public.is_org_member(projects.organization_id)
  )
);

drop policy if exists
  "Members can read readiness dimension scores"
on public.readiness_dimension_scores;

create policy
  "Members can read readiness dimension scores"
on public.readiness_dimension_scores
for select
to authenticated
using (
  exists (
    select 1
    from public.readiness_assessments
    join public.projects
      on projects.id = readiness_assessments.project_id
    where readiness_assessments.id = readiness_dimension_scores.assessment_id
      and public.is_org_member(projects.organization_id)
  )
);

drop policy if exists
  "Members can read readiness blockers"
on public.readiness_blockers;

create policy
  "Members can read readiness blockers"
on public.readiness_blockers
for select
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = readiness_blockers.project_id
      and public.is_org_member(projects.organization_id)
  )
);

drop policy if exists
  "Members can read readiness actions"
on public.readiness_actions;

create policy
  "Members can read readiness actions"
on public.readiness_actions
for select
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = readiness_actions.project_id
      and public.is_org_member(projects.organization_id)
  )
);

drop policy if exists
  "Members can read readiness review events"
on public.readiness_review_events;

create policy
  "Members can read readiness review events"
on public.readiness_review_events
for select
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = readiness_review_events.project_id
      and public.is_org_member(projects.organization_id)
  )
);

revoke all privileges on table public.readiness_assessments from anon;
revoke all privileges on table public.readiness_assessments from authenticated;
revoke all privileges on table public.readiness_dimension_scores from anon;
revoke all privileges on table public.readiness_dimension_scores from authenticated;
revoke all privileges on table public.readiness_blockers from anon;
revoke all privileges on table public.readiness_blockers from authenticated;
revoke all privileges on table public.readiness_actions from anon;
revoke all privileges on table public.readiness_actions from authenticated;
revoke all privileges on table public.readiness_review_events from anon;
revoke all privileges on table public.readiness_review_events from authenticated;

grant select on table public.readiness_assessments to authenticated;
grant select on table public.readiness_dimension_scores to authenticated;
grant select on table public.readiness_blockers to authenticated;
grant select on table public.readiness_actions to authenticated;
grant select on table public.readiness_review_events to authenticated;

create or replace function public.record_readiness_assessment(
  target_project_id uuid,
  target_source text,
  target_source_run_id uuid,
  target_model_version_id uuid,
  target_model_version_number integer,
  target_summary text,
  target_overall_score integer,
  target_level text,
  target_confidence numeric,
  target_evidence_snapshot jsonb,
  target_dimensions jsonb,
  target_blockers jsonb,
  target_actions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_organization_id uuid;
  selected_run public.agent_runs%rowtype;
  selected_review public.agent_run_reviews%rowtype;
  existing_assessment_id uuid;
  new_assessment_id uuid;
  dimension_item jsonb;
  blocker_item jsonb;
  action_item jsonb;
  validated_model_version_number integer;
  dimension_count integer;
  distinct_dimension_count integer;
  blocker_count integer;
  critical_count integer;
  high_count integer;
  medium_count integer;
  low_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if target_source not in ('deterministic', 'agent') then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_source',
      'error', 'La fuente de readiness no es válida.'
    );
  end if;

  select organization_id
  into target_organization_id
  from public.projects
  where id = target_project_id;

  if target_organization_id is null
    or not public.is_org_member(target_organization_id)
  then
    return jsonb_build_object(
      'ok', false,
      'code', 'project_not_found',
      'error', 'El proyecto no existe o no tienes acceso.'
    );
  end if;

  if target_overall_score not between 0 and 100
    or target_level not in (
      'not_ready',
      'at_risk',
      'progressing',
      'ready_for_review',
      'ready'
    )
  then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_score',
      'error', 'La puntuación o el nivel de readiness no es válido.'
    );
  end if;

  if target_confidence is not null
    and (target_confidence < 0 or target_confidence > 1)
  then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_confidence',
      'error', 'La confianza debe estar entre 0 y 1.'
    );
  end if;

  if jsonb_typeof(target_dimensions) <> 'array'
    or jsonb_typeof(target_blockers) <> 'array'
    or jsonb_typeof(target_actions) <> 'array'
  then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_payload',
      'error', 'La evaluación no tiene una estructura válida.'
    );
  end if;

  select count(*), count(distinct value ->> 'key')
  into dimension_count, distinct_dimension_count
  from jsonb_array_elements(target_dimensions);

  if dimension_count <> 8 or distinct_dimension_count <> 8 then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_dimensions',
      'error', 'La evaluación debe contener exactamente las ocho dimensiones de readiness.'
    );
  end if;

  if exists (
    select 1
    from jsonb_array_elements(target_dimensions) as item(value)
    where value ->> 'key' not in (
      'product',
      'domain',
      'architecture',
      'data',
      'security',
      'testing',
      'delivery',
      'operations'
    )
      or coalesce((value ->> 'score')::integer, -1) not between 0 and 100
      or jsonb_typeof(coalesce(value -> 'evidence', 'null'::jsonb)) <> 'array'
      or jsonb_typeof(coalesce(value -> 'gaps', 'null'::jsonb)) <> 'array'
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_dimensions',
      'error', 'Una o más dimensiones de readiness son inválidas.'
    );
  end if;

  if target_model_version_id is null
    and target_model_version_number is not null
  then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_model_version',
      'error', 'La versión del Project Model no es consistente.'
    );
  end if;

  if target_model_version_id is not null then
    select version_number
    into validated_model_version_number
    from public.project_model_versions
    where id = target_model_version_id
      and project_id = target_project_id;

    if validated_model_version_number is null
      or target_model_version_number is distinct from validated_model_version_number
    then
      return jsonb_build_object(
        'ok', false,
        'code', 'invalid_model_version',
        'error', 'La versión del Project Model no pertenece al proyecto o no coincide.'
      );
    end if;
  end if;

  if target_source = 'deterministic' and target_source_run_id is not null then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_source_run',
      'error', 'Una evaluación determinista no puede asociarse a una ejecución de IA.'
    );
  end if;

  if target_source = 'agent' then
    if target_source_run_id is null then
      return jsonb_build_object(
        'ok', false,
        'code', 'run_required',
        'error', 'La evaluación de IA requiere una ejecución de Readiness Assessor.'
      );
    end if;

    select *
    into selected_run
    from public.agent_runs
    where id = target_source_run_id
      and project_id = target_project_id
    for update;

    if selected_run.id is null
      or selected_run.agent_key <> 'readiness'
      or selected_run.status <> 'completed'
    then
      return jsonb_build_object(
        'ok', false,
        'code', 'invalid_run',
        'error', 'La ejecución no es un resultado completado de Readiness Assessor.'
      );
    end if;

    select *
    into selected_review
    from public.agent_run_reviews
    where run_id = target_source_run_id
      and project_id = target_project_id;

    if selected_review.id is null
      or selected_review.decision <> 'approved'
    then
      return jsonb_build_object(
        'ok', false,
        'code', 'run_not_approved',
        'error', 'La ejecución de Readiness Assessor debe estar aprobada antes de importarse.'
      );
    end if;

    select id
    into existing_assessment_id
    from public.readiness_assessments
    where source_run_id = target_source_run_id;

    if existing_assessment_id is not null then
      return jsonb_build_object(
        'ok', true,
        'assessmentId', existing_assessment_id,
        'existing', true
      );
    end if;
  end if;

  select
    count(*),
    count(*) filter (where value ->> 'priority' = 'critical'),
    count(*) filter (where value ->> 'priority' = 'high'),
    count(*) filter (where value ->> 'priority' = 'medium'),
    count(*) filter (where value ->> 'priority' = 'low')
  into
    blocker_count,
    critical_count,
    high_count,
    medium_count,
    low_count
  from jsonb_array_elements(target_blockers);

  if exists (
    select 1
    from jsonb_array_elements(target_blockers) as item(value)
    where value ->> 'dimension' not in (
      'product',
      'domain',
      'architecture',
      'data',
      'security',
      'testing',
      'delivery',
      'operations'
    )
      or value ->> 'priority' not in ('low', 'medium', 'high', 'critical')
      or coalesce(value ->> 'fingerprint', '') = ''
      or coalesce(value ->> 'title', '') = ''
      or coalesce(value ->> 'reason', '') = ''
      or jsonb_typeof(coalesce(value -> 'evidence', 'null'::jsonb)) <> 'array'
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_blockers',
      'error', 'Uno o más bloqueadores de readiness son inválidos.'
    );
  end if;

  if exists (
    select 1
    from jsonb_array_elements(target_actions) as item(value)
    where value ->> 'dimension' not in (
      'product',
      'domain',
      'architecture',
      'data',
      'security',
      'testing',
      'delivery',
      'operations'
    )
      or value ->> 'priority' not in ('low', 'medium', 'high')
      or coalesce(value ->> 'fingerprint', '') = ''
      or coalesce(value ->> 'action', '') = ''
      or coalesce(value ->> 'ownerRole', '') = ''
      or coalesce(value ->> 'expectedOutcome', '') = ''
  ) then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_actions',
      'error', 'Una o más acciones de readiness son inválidas.'
    );
  end if;

  insert into public.readiness_assessments (
    project_id,
    source,
    source_run_id,
    project_model_version_id,
    project_model_version_number,
    overall_score,
    level,
    summary,
    confidence,
    evidence_snapshot,
    blocker_count,
    critical_blocker_count,
    high_blocker_count,
    medium_blocker_count,
    low_blocker_count,
    created_by
  ) values (
    target_project_id,
    target_source,
    target_source_run_id,
    target_model_version_id,
    target_model_version_number,
    target_overall_score,
    target_level,
    target_summary,
    target_confidence,
    coalesce(target_evidence_snapshot, '{}'::jsonb),
    blocker_count,
    critical_count,
    high_count,
    medium_count,
    low_count,
    auth.uid()
  )
  returning id into new_assessment_id;

  for dimension_item in
    select value
    from jsonb_array_elements(target_dimensions)
  loop
    insert into public.readiness_dimension_scores (
      assessment_id,
      dimension_key,
      score,
      rationale,
      evidence,
      gaps
    ) values (
      new_assessment_id,
      dimension_item ->> 'key',
      (dimension_item ->> 'score')::integer,
      dimension_item ->> 'rationale',
      dimension_item -> 'evidence',
      dimension_item -> 'gaps'
    );
  end loop;

  for blocker_item in
    select value
    from jsonb_array_elements(target_blockers)
  loop
    insert into public.readiness_blockers (
      assessment_id,
      project_id,
      fingerprint,
      dimension_key,
      title,
      reason,
      priority,
      evidence
    ) values (
      new_assessment_id,
      target_project_id,
      blocker_item ->> 'fingerprint',
      blocker_item ->> 'dimension',
      blocker_item ->> 'title',
      blocker_item ->> 'reason',
      blocker_item ->> 'priority',
      blocker_item -> 'evidence'
    );
  end loop;

  for action_item in
    select value
    from jsonb_array_elements(target_actions)
  loop
    insert into public.readiness_actions (
      assessment_id,
      project_id,
      fingerprint,
      dimension_key,
      action,
      owner_role,
      expected_outcome,
      priority
    ) values (
      new_assessment_id,
      target_project_id,
      action_item ->> 'fingerprint',
      action_item ->> 'dimension',
      action_item ->> 'action',
      action_item ->> 'ownerRole',
      action_item ->> 'expectedOutcome',
      action_item ->> 'priority'
    );
  end loop;

  return jsonb_build_object(
    'ok', true,
    'assessmentId', new_assessment_id,
    'existing', false
  );
end;
$$;

revoke all
on function public.record_readiness_assessment(
  uuid,
  text,
  uuid,
  uuid,
  integer,
  text,
  integer,
  text,
  numeric,
  jsonb,
  jsonb,
  jsonb,
  jsonb
)
from public;

grant execute
on function public.record_readiness_assessment(
  uuid,
  text,
  uuid,
  uuid,
  integer,
  text,
  integer,
  text,
  numeric,
  jsonb,
  jsonb,
  jsonb,
  jsonb
)
to authenticated;

create or replace function public.review_readiness_blocker(
  target_blocker_id uuid,
  target_status text,
  target_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_blocker public.readiness_blockers%rowtype;
  target_organization_id uuid;
  normalized_comment text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if target_status not in ('open', 'accepted', 'resolved', 'dismissed') then
    return jsonb_build_object(
      'ok', false,
      'error', 'El estado del bloqueador no es válido.'
    );
  end if;

  select *
  into selected_blocker
  from public.readiness_blockers
  where id = target_blocker_id
  for update;

  if selected_blocker.id is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'El bloqueador no existe o no está disponible.'
    );
  end if;

  select organization_id
  into target_organization_id
  from public.projects
  where id = selected_blocker.project_id;

  if target_organization_id is null
    or not public.is_org_admin(target_organization_id)
  then
    return jsonb_build_object(
      'ok', false,
      'error', 'Solo owner o admin pueden revisar bloqueadores.'
    );
  end if;

  normalized_comment := nullif(trim(coalesce(target_comment, '')), '');

  update public.readiness_blockers
  set
    status = target_status,
    review_comment = normalized_comment,
    reviewed_by = case when target_status = 'open' then null else auth.uid() end,
    reviewed_at = case when target_status = 'open' then null else now() end,
    updated_at = now()
  where id = target_blocker_id;

  insert into public.readiness_review_events (
    project_id,
    assessment_id,
    item_type,
    item_id,
    status_from,
    status_to,
    comment,
    actor_id
  ) values (
    selected_blocker.project_id,
    selected_blocker.assessment_id,
    'blocker',
    selected_blocker.id,
    selected_blocker.status,
    target_status,
    normalized_comment,
    auth.uid()
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all
on function public.review_readiness_blocker(uuid, text, text)
from public;

grant execute
on function public.review_readiness_blocker(uuid, text, text)
to authenticated;

create or replace function public.review_readiness_action(
  target_action_id uuid,
  target_status text,
  target_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_action public.readiness_actions%rowtype;
  target_organization_id uuid;
  normalized_comment text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if target_status not in ('pending', 'in_progress', 'completed', 'dismissed') then
    return jsonb_build_object(
      'ok', false,
      'error', 'El estado de la acción no es válido.'
    );
  end if;

  select *
  into selected_action
  from public.readiness_actions
  where id = target_action_id
  for update;

  if selected_action.id is null then
    return jsonb_build_object(
      'ok', false,
      'error', 'La acción no existe o no está disponible.'
    );
  end if;

  select organization_id
  into target_organization_id
  from public.projects
  where id = selected_action.project_id;

  if target_organization_id is null
    or not public.is_org_admin(target_organization_id)
  then
    return jsonb_build_object(
      'ok', false,
      'error', 'Solo owner o admin pueden actualizar acciones.'
    );
  end if;

  normalized_comment := nullif(trim(coalesce(target_comment, '')), '');

  update public.readiness_actions
  set
    status = target_status,
    review_comment = normalized_comment,
    reviewed_by = case when target_status = 'pending' then null else auth.uid() end,
    reviewed_at = case when target_status = 'pending' then null else now() end,
    updated_at = now()
  where id = target_action_id;

  insert into public.readiness_review_events (
    project_id,
    assessment_id,
    item_type,
    item_id,
    status_from,
    status_to,
    comment,
    actor_id
  ) values (
    selected_action.project_id,
    selected_action.assessment_id,
    'action',
    selected_action.id,
    selected_action.status,
    target_status,
    normalized_comment,
    auth.uid()
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all
on function public.review_readiness_action(uuid, text, text)
from public;

grant execute
on function public.review_readiness_action(uuid, text, text)
to authenticated;

commit;
