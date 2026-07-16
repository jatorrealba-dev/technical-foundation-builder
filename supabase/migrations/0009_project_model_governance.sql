begin;

alter table public.project_model_versions
  add column if not exists source_change_set_id uuid;

create table if not exists public.project_model_change_sets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null
    references public.projects(id)
    on delete cascade,
  source_type text not null default 'agent_run',
  source_run_id uuid
    references public.agent_runs(id)
    on delete set null,
  source_review_id uuid
    references public.agent_run_reviews(id)
    on delete set null,
  base_model_version_id uuid
    references public.project_model_versions(id)
    on delete set null,
  resulting_model_version_id uuid
    references public.project_model_versions(id)
    on delete set null,
  title text not null,
  summary jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  total_change_count integer not null default 0,
  accepted_change_count integer not null default 0,
  rejected_change_count integer not null default 0,
  application_summary jsonb not null default '{}'::jsonb,
  created_by uuid
    references auth.users(id)
    on delete set null,
  applied_by uuid
    references auth.users(id)
    on delete set null,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_model_change_sets_source_type_valid
    check (source_type in ('agent_run', 'manual')),

  constraint project_model_change_sets_status_valid
    check (
      status in (
        'draft',
        'reviewing',
        'ready',
        'applied',
        'rejected',
        'cancelled'
      )
    ),

  constraint project_model_change_sets_counts_non_negative
    check (
      total_change_count >= 0
      and accepted_change_count >= 0
      and rejected_change_count >= 0
      and accepted_change_count + rejected_change_count <= total_change_count
    ),

  constraint project_model_change_sets_source_consistent
    check (
      source_type = 'agent_run'
      or (source_type = 'manual' and source_run_id is null)
    )
);

create unique index if not exists
  idx_project_model_change_sets_source_run_unique
on public.project_model_change_sets (source_run_id)
where source_run_id is not null;

create index if not exists
  idx_project_model_change_sets_project_created_at
on public.project_model_change_sets (
  project_id,
  created_at desc
);

create table if not exists public.project_model_changes (
  id uuid primary key default gen_random_uuid(),
  change_set_id uuid not null
    references public.project_model_change_sets(id)
    on delete cascade,
  project_id uuid not null
    references public.projects(id)
    on delete cascade,
  category text not null,
  operation text not null,
  entity_key text not null,
  label text not null,
  before_value jsonb,
  after_value jsonb,
  decision text not null default 'pending',
  reviewer_comment text,
  reviewed_by uuid
    references auth.users(id)
    on delete set null,
  reviewed_at timestamptz,
  impacted_artifact_types jsonb not null default '[]'::jsonb,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint project_model_changes_category_valid
    check (
      category in (
        'requirement',
        'assumption',
        'domain_entity',
        'risk',
        'open_question',
        'model_status'
      )
    ),

  constraint project_model_changes_operation_valid
    check (operation in ('add', 'update', 'remove')),

  constraint project_model_changes_decision_valid
    check (decision in ('pending', 'accepted', 'rejected')),

  constraint project_model_changes_payload_consistent
    check (
      (operation = 'add' and before_value is null and after_value is not null)
      or (operation = 'update' and before_value is not null and after_value is not null)
      or (operation = 'remove' and before_value is not null and after_value is null)
    ),

  constraint project_model_changes_review_metadata_consistent
    check (
      (decision = 'pending' and reviewed_by is null and reviewed_at is null)
      or (decision in ('accepted', 'rejected') and reviewed_by is not null and reviewed_at is not null)
    ),

  constraint project_model_changes_comment_length
    check (
      reviewer_comment is null
      or char_length(reviewer_comment) <= 4000
    ),

  constraint project_model_changes_set_entity_unique
    unique (change_set_id, category, entity_key)
);

create index if not exists
  idx_project_model_changes_set_order
on public.project_model_changes (
  change_set_id,
  display_order,
  created_at
);

create index if not exists
  idx_project_model_changes_project_decision
on public.project_model_changes (
  project_id,
  decision,
  updated_at desc
);

create table if not exists public.project_artifact_states (
  project_id uuid not null
    references public.projects(id)
    on delete cascade,
  artifact_type text not null,
  status text not null default 'current',
  based_on_model_version integer,
  reason text,
  updated_at timestamptz not null default now(),

  primary key (project_id, artifact_type),

  constraint project_artifact_states_type_valid
    check (
      artifact_type in (
        'product_spec',
        'mvp_scope',
        'domain_model',
        'architecture',
        'data_model',
        'security',
        'backlog',
        'vertical_slice_plan'
      )
    ),

  constraint project_artifact_states_status_valid
    check (status in ('current', 'outdated', 'regenerating', 'failed')),

  constraint project_artifact_states_version_positive
    check (
      based_on_model_version is null
      or based_on_model_version > 0
    )
);

alter table public.project_model_versions
  drop constraint if exists project_model_versions_source_change_set_fkey;

alter table public.project_model_versions
  add constraint project_model_versions_source_change_set_fkey
  foreign key (source_change_set_id)
  references public.project_model_change_sets(id)
  on delete set null;

create index if not exists
  idx_project_model_versions_source_change_set
on public.project_model_versions (source_change_set_id)
where source_change_set_id is not null;

comment on table public.project_model_change_sets is
  'Governed proposals that group granular changes to a Project Model.';

comment on table public.project_model_changes is
  'Individually reviewable additions, updates, and removals within a Project Model change set.';

comment on table public.project_artifact_states is
  'Freshness and Project Model version provenance for generated project artifacts.';

create or replace function public.capture_project_model_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_version_number integer;
  configured_source_run text;
  configured_source_review text;
  configured_source_change_set text;
  configured_restored_version text;
  configured_reason text;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(new.project_id::text, 0)
  );

  select coalesce(max(version_number), 0) + 1
  into next_version_number
  from public.project_model_versions
  where project_id = new.project_id;

  configured_source_run :=
    current_setting('app.source_run_id', true);

  configured_source_review :=
    current_setting('app.source_review_id', true);

  configured_source_change_set :=
    current_setting('app.source_change_set_id', true);

  configured_restored_version :=
    current_setting(
      'app.restored_from_project_model_version_id',
      true
    );

  configured_reason :=
    current_setting('app.project_model_change_reason', true);

  insert into public.project_model_versions (
    project_model_id,
    project_id,
    version_number,
    status,
    requirements,
    assumptions,
    domain_entities,
    risks,
    open_questions,
    source_run_id,
    source_review_id,
    source_change_set_id,
    restored_from_version_id,
    change_reason,
    created_by,
    created_at
  )
  values (
    new.id,
    new.project_id,
    next_version_number,
    new.status,
    new.requirements,
    new.assumptions,
    new.domain_entities,
    new.risks,
    new.open_questions,
    nullif(configured_source_run, '')::uuid,
    nullif(configured_source_review, '')::uuid,
    nullif(configured_source_change_set, '')::uuid,
    nullif(configured_restored_version, '')::uuid,
    coalesce(
      nullif(configured_reason, ''),
      'Project Model updated'
    ),
    auth.uid(),
    new.updated_at
  );

  return new;
end;
$$;

revoke all
on function public.capture_project_model_version()
from public;

insert into public.project_artifact_states (
  project_id,
  artifact_type,
  status,
  based_on_model_version,
  reason,
  updated_at
)
select
  artifacts.project_id,
  artifacts.type,
  'current',
  (
    select max(version_number)
    from public.project_model_versions
    where project_model_versions.project_id = artifacts.project_id
  ),
  'Artifact state backfill',
  artifacts.updated_at
from public.artifacts
on conflict (project_id, artifact_type)
do nothing;

create or replace function public.capture_artifact_freshness()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  current_model_version integer;
begin
  select max(version_number)
  into current_model_version
  from public.project_model_versions
  where project_id = new.project_id;

  insert into public.project_artifact_states (
    project_id,
    artifact_type,
    status,
    based_on_model_version,
    reason,
    updated_at
  )
  values (
    new.project_id,
    new.type,
    'current',
    current_model_version,
    'Artifact generated or regenerated',
    new.updated_at
  )
  on conflict (project_id, artifact_type)
  do update set
    status = excluded.status,
    based_on_model_version = excluded.based_on_model_version,
    reason = excluded.reason,
    updated_at = excluded.updated_at;

  return new;
end;
$$;

revoke all
on function public.capture_artifact_freshness()
from public;

drop trigger if exists
  capture_artifact_freshness_on_write
on public.artifacts;

create trigger capture_artifact_freshness_on_write
after insert or update of content, updated_at
on public.artifacts
for each row
execute function public.capture_artifact_freshness();

alter table public.project_model_change_sets enable row level security;
alter table public.project_model_changes enable row level security;
alter table public.project_artifact_states enable row level security;

drop policy if exists
  "Members can read Project Model change sets"
on public.project_model_change_sets;

create policy
  "Members can read Project Model change sets"
on public.project_model_change_sets
for select
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = project_model_change_sets.project_id
      and public.is_org_member(projects.organization_id)
  )
);

drop policy if exists
  "Members can read Project Model changes"
on public.project_model_changes;

create policy
  "Members can read Project Model changes"
on public.project_model_changes
for select
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = project_model_changes.project_id
      and public.is_org_member(projects.organization_id)
  )
);

drop policy if exists
  "Members can read artifact freshness"
on public.project_artifact_states;

create policy
  "Members can read artifact freshness"
on public.project_artifact_states
for select
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = project_artifact_states.project_id
      and public.is_org_member(projects.organization_id)
  )
);

revoke all privileges on table public.project_model_change_sets from anon;
revoke all privileges on table public.project_model_change_sets from authenticated;
revoke all privileges on table public.project_model_changes from anon;
revoke all privileges on table public.project_model_changes from authenticated;
revoke all privileges on table public.project_artifact_states from anon;
revoke all privileges on table public.project_artifact_states from authenticated;

grant select on table public.project_model_change_sets to authenticated;
grant select on table public.project_model_changes to authenticated;
grant select on table public.project_artifact_states to authenticated;

create or replace function public.create_project_model_change_set(
  target_project_id uuid,
  target_run_id uuid,
  target_title text,
  target_summary jsonb,
  target_changes jsonb
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
  existing_change_set_id uuid;
  base_version_id uuid;
  new_change_set_id uuid;
  change_count integer;
  changes_valid boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select organization_id
  into target_organization_id
  from public.projects
  where id = target_project_id;

  if target_organization_id is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'project_not_found',
      'error', 'El proyecto no existe o no tienes acceso.'
    );
  end if;

  if not public.is_org_admin(target_organization_id) then
    return jsonb_build_object(
      'ok', false,
      'code', 'forbidden',
      'error', 'Solo un owner o admin puede preparar propuestas de cambios.'
    );
  end if;

  select *
  into selected_run
  from public.agent_runs
  where id = target_run_id
    and project_id = target_project_id;

  if selected_run.id is null
    or selected_run.agent_key <> 'project_model'
    or selected_run.status <> 'completed'
    or selected_run.output is null
  then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_run',
      'error', 'La ejecución no es un Project Model Analyst completado.'
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_run_id::text, 0)
  );

  select *
  into selected_review
  from public.agent_run_reviews
  where run_id = target_run_id
    and project_id = target_project_id
  for update;

  if selected_review.id is null
    or selected_review.decision <> 'approved'
  then
    return jsonb_build_object(
      'ok', false,
      'code', 'review_not_approved',
      'error', 'La ejecución debe estar aprobada antes de preparar cambios.'
    );
  end if;

  if selected_review.application_status = 'applied' then
    return jsonb_build_object(
      'ok', false,
      'code', 'already_applied',
      'error', 'La ejecución ya fue aplicada al Project Model.'
    );
  end if;

  select id
  into existing_change_set_id
  from public.project_model_change_sets
  where source_run_id = target_run_id;

  if existing_change_set_id is not null then
    return jsonb_build_object(
      'ok', true,
      'changeSetId', existing_change_set_id,
      'existing', true
    );
  end if;

  if jsonb_typeof(target_changes) <> 'array' then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_changes',
      'error', 'La propuesta de cambios no tiene una estructura válida.'
    );
  end if;

  select
    count(*),
    coalesce(
      bool_and(
        change->>'category' = any(
          array[
            'requirement',
            'assumption',
            'domain_entity',
            'risk',
            'open_question',
            'model_status'
          ]
        )
        and change->>'operation' = any(
          array['add', 'update', 'remove']
        )
        and coalesce(change->>'entityKey', '') <> ''
        and coalesce(change->>'label', '') <> ''
        and (
          (change->>'operation' = 'add'
            and coalesce(change->'beforeValue', 'null'::jsonb) = 'null'::jsonb
            and coalesce(change->'afterValue', 'null'::jsonb) <> 'null'::jsonb)
          or (change->>'operation' = 'update'
            and coalesce(change->'beforeValue', 'null'::jsonb) <> 'null'::jsonb
            and coalesce(change->'afterValue', 'null'::jsonb) <> 'null'::jsonb)
          or (change->>'operation' = 'remove'
            and coalesce(change->'beforeValue', 'null'::jsonb) <> 'null'::jsonb
            and coalesce(change->'afterValue', 'null'::jsonb) = 'null'::jsonb)
        )
        and case
          when jsonb_typeof(change->'impactedArtifactTypes') = 'array'
          then
            jsonb_array_length(change->'impactedArtifactTypes') > 0
            and change->'impactedArtifactTypes' <@ '[
              "product_spec",
              "mvp_scope",
              "domain_model",
              "architecture",
              "data_model",
              "security",
              "backlog",
              "vertical_slice_plan"
            ]'::jsonb
          else false
        end
      ),
      false
    )
  into change_count, changes_valid
  from jsonb_array_elements(target_changes) as change;

  if change_count = 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'no_changes',
      'error', 'La ejecución no propone cambios respecto al modelo vigente.'
    );
  end if;

  if not changes_valid then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_changes',
      'error', 'Uno o más cambios propuestos no son válidos.'
    );
  end if;

  select id
  into base_version_id
  from public.project_model_versions
  where project_id = target_project_id
  order by version_number desc
  limit 1;

  insert into public.project_model_change_sets (
    project_id,
    source_type,
    source_run_id,
    source_review_id,
    base_model_version_id,
    title,
    summary,
    status,
    total_change_count,
    created_by
  )
  values (
    target_project_id,
    'agent_run',
    target_run_id,
    selected_review.id,
    base_version_id,
    left(coalesce(nullif(target_title, ''), 'Propuesta de Project Model Analyst'), 240),
    coalesce(target_summary, '{}'::jsonb),
    'reviewing',
    change_count,
    auth.uid()
  )
  returning id into new_change_set_id;

  insert into public.project_model_changes (
    change_set_id,
    project_id,
    category,
    operation,
    entity_key,
    label,
    before_value,
    after_value,
    decision,
    impacted_artifact_types,
    display_order
  )
  select
    new_change_set_id,
    target_project_id,
    change->>'category',
    change->>'operation',
    change->>'entityKey',
    left(change->>'label', 500),
    nullif(change->'beforeValue', 'null'::jsonb),
    nullif(change->'afterValue', 'null'::jsonb),
    'pending',
    change->'impactedArtifactTypes',
    ordinality::integer
  from jsonb_array_elements(target_changes)
    with ordinality as proposed(change, ordinality);

  insert into public.agent_run_events (
    run_id,
    event_type,
    payload
  )
  values (
    target_run_id,
    'change_set_created',
    jsonb_build_object(
      'changeSetId', new_change_set_id,
      'changeCount', change_count,
      'createdBy', auth.uid()
    )
  );

  return jsonb_build_object(
    'ok', true,
    'changeSetId', new_change_set_id,
    'existing', false,
    'changeCount', change_count
  );
end;
$$;

create or replace function public.review_project_model_change(
  target_change_set_id uuid,
  target_change_id uuid,
  target_decision text,
  target_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_set public.project_model_change_sets%rowtype;
  target_organization_id uuid;
  pending_count integer;
  accepted_count integer;
  rejected_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if target_decision not in ('accepted', 'rejected') then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_decision',
      'error', 'La decisión del cambio no es válida.'
    );
  end if;

  if target_comment is not null and char_length(target_comment) > 4000 then
    return jsonb_build_object(
      'ok', false,
      'code', 'comment_too_long',
      'error', 'El comentario no puede superar 4000 caracteres.'
    );
  end if;

  select *
  into selected_set
  from public.project_model_change_sets
  where id = target_change_set_id
  for update;

  if selected_set.id is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'change_set_not_found',
      'error', 'La propuesta de cambios no existe.'
    );
  end if;

  select organization_id
  into target_organization_id
  from public.projects
  where id = selected_set.project_id;

  if not public.is_org_admin(target_organization_id) then
    return jsonb_build_object(
      'ok', false,
      'code', 'forbidden',
      'error', 'Solo un owner o admin puede revisar cambios.'
    );
  end if;

  if selected_set.status in ('applied', 'rejected', 'cancelled') then
    return jsonb_build_object(
      'ok', false,
      'code', 'change_set_closed',
      'error', 'La propuesta ya está cerrada y no admite nuevas decisiones.'
    );
  end if;

  update public.project_model_changes
  set
    decision = target_decision,
    reviewer_comment = nullif(target_comment, ''),
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  where id = target_change_id
    and change_set_id = target_change_set_id;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'change_not_found',
      'error', 'El cambio seleccionado no pertenece a esta propuesta.'
    );
  end if;

  select
    count(*) filter (where decision = 'pending'),
    count(*) filter (where decision = 'accepted'),
    count(*) filter (where decision = 'rejected')
  into pending_count, accepted_count, rejected_count
  from public.project_model_changes
  where change_set_id = target_change_set_id;

  update public.project_model_change_sets
  set
    status = case
      when pending_count = 0 then 'ready'
      else 'reviewing'
    end,
    accepted_change_count = accepted_count,
    rejected_change_count = rejected_count,
    updated_at = now()
  where id = target_change_set_id;

  return jsonb_build_object(
    'ok', true,
    'pendingCount', pending_count,
    'acceptedCount', accepted_count,
    'rejectedCount', rejected_count,
    'status', case when pending_count = 0 then 'ready' else 'reviewing' end
  );
end;
$$;

create or replace function public.apply_project_model_change_set(
  target_change_set_id uuid,
  target_model jsonb,
  target_artifacts jsonb,
  target_impacted_artifact_types text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_set public.project_model_change_sets%rowtype;
  target_organization_id uuid;
  selected_review public.agent_run_reviews%rowtype;
  pending_count integer;
  accepted_count integer;
  computed_impacted_types text[];
  normalized_target_types text[];
  expected_artifact_count integer;
  artifact_count integer;
  distinct_artifact_count integer;
  artifact_types_valid boolean;
  applied_at timestamptz := now();
  current_generated_at timestamptz;
  current_model_version_id uuid;
  new_model_version_id uuid;
  new_model_version_number integer;
  result_summary jsonb;
  failure_message text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select *
  into selected_set
  from public.project_model_change_sets
  where id = target_change_set_id
  for update;

  if selected_set.id is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'change_set_not_found',
      'error', 'La propuesta de cambios no existe.'
    );
  end if;

  select organization_id
  into target_organization_id
  from public.projects
  where id = selected_set.project_id;

  if not public.is_org_admin(target_organization_id) then
    return jsonb_build_object(
      'ok', false,
      'code', 'forbidden',
      'error', 'Solo un owner o admin puede aplicar cambios.'
    );
  end if;

  if selected_set.status = 'applied' then
    return jsonb_build_object(
      'ok', false,
      'code', 'already_applied',
      'error', 'La propuesta ya fue aplicada.'
    );
  end if;

  if selected_set.status in ('rejected', 'cancelled') then
    return jsonb_build_object(
      'ok', false,
      'code', 'change_set_closed',
      'error', 'La propuesta está cerrada y no puede aplicarse.'
    );
  end if;

  perform 1
  from public.project_models
  where project_id = selected_set.project_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'project_model_not_found',
      'error', 'No existe un Project Model vigente para aplicar la propuesta.'
    );
  end if;

  select id
  into current_model_version_id
  from public.project_model_versions
  where project_id = selected_set.project_id
  order by version_number desc
  limit 1;

  if selected_set.base_model_version_id is distinct from current_model_version_id then
    return jsonb_build_object(
      'ok', false,
      'code', 'stale_change_set',
      'error', 'El Project Model cambió después de crear esta propuesta. Prepara una propuesta nueva sobre la versión vigente.'
    );
  end if;

  select
    count(*) filter (where decision = 'pending'),
    count(*) filter (where decision = 'accepted')
  into pending_count, accepted_count
  from public.project_model_changes
  where change_set_id = target_change_set_id;

  if pending_count > 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'pending_changes',
      'error', 'Todos los cambios deben revisarse antes de aplicar la propuesta.'
    );
  end if;

  if accepted_count = 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'no_accepted_changes',
      'error', 'Debes aceptar al menos un cambio antes de aplicar la propuesta.'
    );
  end if;

  if jsonb_typeof(target_model) <> 'object'
    or coalesce(target_model->>'status', '') not in (
      'draft',
      'generated',
      'review_required',
      'approved'
    )
    or jsonb_typeof(target_model->'requirements') <> 'array'
    or jsonb_typeof(target_model->'assumptions') <> 'array'
    or jsonb_typeof(target_model->'domainEntities') <> 'array'
    or jsonb_typeof(target_model->'risks') <> 'array'
    or jsonb_typeof(target_model->'openQuestions') <> 'array'
  then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_model_payload',
      'error', 'El Project Model resultante no tiene una estructura válida.'
    );
  end if;

  select coalesce(array_agg(distinct artifact_type order by artifact_type), array[]::text[])
  into computed_impacted_types
  from (
    select jsonb_array_elements_text(impacted_artifact_types) as artifact_type
    from public.project_model_changes
    where change_set_id = target_change_set_id
      and decision = 'accepted'
  ) impacted;

  select coalesce(array_agg(distinct value order by value), array[]::text[])
  into normalized_target_types
  from unnest(coalesce(target_impacted_artifact_types, array[]::text[])) as value;

  if computed_impacted_types <> normalized_target_types then
    return jsonb_build_object(
      'ok', false,
      'code', 'artifact_impact_mismatch',
      'error', 'La lista de documentos afectados no coincide con los cambios aceptados.'
    );
  end if;

  expected_artifact_count := coalesce(array_length(normalized_target_types, 1), 0);

  if expected_artifact_count = 0 or jsonb_typeof(target_artifacts) <> 'array' then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_artifact_payload',
      'error', 'No existe un paquete válido de documentos afectados.'
    );
  end if;

  select
    count(*),
    count(distinct artifact->>'type'),
    coalesce(
      bool_and(
        artifact->>'type' = any(normalized_target_types)
        and coalesce(artifact->>'title', '') <> ''
        and coalesce(artifact->>'filename', '') <> ''
        and artifact->>'format' = 'markdown'
        and coalesce(artifact->>'content', '') <> ''
      ),
      false
    )
  into artifact_count, distinct_artifact_count, artifact_types_valid
  from jsonb_array_elements(target_artifacts) as artifact;

  if artifact_count <> expected_artifact_count
    or distinct_artifact_count <> expected_artifact_count
    or not artifact_types_valid
  then
    return jsonb_build_object(
      'ok', false,
      'code', 'incomplete_artifact_payload',
      'error', 'El paquete no contiene exactamente los documentos afectados.'
    );
  end if;

  if selected_set.source_review_id is not null then
    select *
    into selected_review
    from public.agent_run_reviews
    where id = selected_set.source_review_id
    for update;

    if selected_review.id is null
      or selected_review.decision <> 'approved'
    then
      return jsonb_build_object(
        'ok', false,
        'code', 'review_not_approved',
        'error', 'La revisión de origen ya no está aprobada.'
      );
    end if;

    if selected_review.application_status = 'applied' then
      return jsonb_build_object(
        'ok', false,
        'code', 'already_applied',
        'error', 'La ejecución de origen ya fue aplicada.'
      );
    end if;

    update public.agent_run_reviews
    set
      application_status = 'applying',
      application_summary = jsonb_build_object(
        'target', 'project_models',
        'changeSetId', target_change_set_id,
        'startedAt', applied_at
      ),
      updated_at = applied_at
    where id = selected_review.id;
  end if;

  begin
    perform set_config(
      'app.source_run_id',
      coalesce(selected_set.source_run_id::text, ''),
      true
    );

    perform set_config(
      'app.source_review_id',
      coalesce(selected_set.source_review_id::text, ''),
      true
    );

    perform set_config(
      'app.source_change_set_id',
      target_change_set_id::text,
      true
    );

    perform set_config(
      'app.project_model_change_reason',
      case
        when selected_set.source_type = 'manual'
          then 'Applied manual Project Model edit'
        else 'Applied reviewed Project Model change set'
      end,
      true
    );

    select generated_at
    into current_generated_at
    from public.project_models
    where project_id = selected_set.project_id;

    insert into public.project_models (
      project_id,
      status,
      requirements,
      assumptions,
      domain_entities,
      risks,
      open_questions,
      generated_at,
      updated_at
    )
    values (
      selected_set.project_id,
      coalesce(target_model->>'status', 'approved'),
      target_model->'requirements',
      target_model->'assumptions',
      target_model->'domainEntities',
      target_model->'risks',
      target_model->'openQuestions',
      coalesce(current_generated_at, applied_at),
      applied_at
    )
    on conflict (project_id)
    do update set
      status = excluded.status,
      requirements = excluded.requirements,
      assumptions = excluded.assumptions,
      domain_entities = excluded.domain_entities,
      risks = excluded.risks,
      open_questions = excluded.open_questions,
      updated_at = excluded.updated_at;

    insert into public.artifacts (
      project_id,
      type,
      title,
      filename,
      format,
      content,
      updated_at
    )
    select
      selected_set.project_id,
      artifact->>'type',
      artifact->>'title',
      artifact->>'filename',
      artifact->>'format',
      artifact->>'content',
      applied_at
    from jsonb_array_elements(target_artifacts) as artifact
    on conflict (project_id, type)
    do update set
      title = excluded.title,
      filename = excluded.filename,
      format = excluded.format,
      content = excluded.content,
      updated_at = excluded.updated_at;

    select id, version_number
    into new_model_version_id, new_model_version_number
    from public.project_model_versions
    where project_id = selected_set.project_id
    order by version_number desc
    limit 1;

    update public.project_artifact_states
    set
      status = 'current',
      based_on_model_version = new_model_version_number,
      reason = 'Unchanged by Project Model change set',
      updated_at = applied_at
    where project_id = selected_set.project_id
      and not (artifact_type = any(normalized_target_types));

    insert into public.project_artifact_states (
      project_id,
      artifact_type,
      status,
      based_on_model_version,
      reason,
      updated_at
    )
    select
      selected_set.project_id,
      value,
      'current',
      new_model_version_number,
      'Regenerated after Project Model change set',
      applied_at
    from unnest(normalized_target_types) as value
    on conflict (project_id, artifact_type)
    do update set
      status = excluded.status,
      based_on_model_version = excluded.based_on_model_version,
      reason = excluded.reason,
      updated_at = excluded.updated_at;

    update public.projects
    set
      status = case
        when (
          select count(*)
          from public.artifacts
          where project_id = selected_set.project_id
        ) = 8 then 'package_generated'
        else status
      end,
      updated_at = applied_at
    where id = selected_set.project_id;

    result_summary := jsonb_build_object(
      'target', 'project_models',
      'changeSetId', target_change_set_id,
      'acceptedChangeCount', accepted_count,
      'projectModelVersion', new_model_version_number,
      'regeneratedArtifactCount', artifact_count,
      'regeneratedArtifactTypes', to_jsonb(normalized_target_types),
      'appliedAt', applied_at
    );

    update public.project_model_change_sets
    set
      status = 'applied',
      resulting_model_version_id = new_model_version_id,
      accepted_change_count = accepted_count,
      application_summary = result_summary,
      applied_by = auth.uid(),
      applied_at = applied_at,
      updated_at = applied_at
    where id = target_change_set_id;

    if selected_set.source_review_id is not null then
      update public.agent_run_reviews
      set
        application_status = 'applied',
        application_summary = result_summary,
        applied_by = auth.uid(),
        applied_at = applied_at,
        updated_at = applied_at
      where id = selected_set.source_review_id;
    end if;

    if selected_set.source_run_id is not null then
      insert into public.agent_run_events (
        run_id,
        event_type,
        payload,
        created_at
      )
      values (
        selected_set.source_run_id,
        'change_set_applied',
        result_summary,
        applied_at
      );
    end if;
  exception
    when others then
      failure_message := sqlerrm;

      if selected_set.source_review_id is not null then
        update public.agent_run_reviews
        set
          application_status = 'failed',
          application_summary = jsonb_build_object(
            'changeSetId', target_change_set_id,
            'error', failure_message,
            'failedAt', now()
          ),
          updated_at = now()
        where id = selected_set.source_review_id;
      end if;

      return jsonb_build_object(
        'ok', false,
        'code', 'transaction_failed',
        'error', failure_message
      );
  end;

  return jsonb_build_object(
    'ok', true,
    'summary', result_summary
  );
end;
$$;

create or replace function public.create_and_apply_manual_project_model_change_set(
  target_project_id uuid,
  target_base_model_version_id uuid,
  target_title text,
  target_reason text,
  target_summary jsonb,
  target_changes jsonb,
  target_model jsonb,
  target_artifacts jsonb,
  target_impacted_artifact_types text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_organization_id uuid;
  base_version_id uuid;
  new_change_set_id uuid;
  change_count integer;
  changes_valid boolean;
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select organization_id
  into target_organization_id
  from public.projects
  where id = target_project_id;

  if target_organization_id is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'project_not_found',
      'error', 'El proyecto no existe o no tienes acceso.'
    );
  end if;

  if not public.is_org_admin(target_organization_id) then
    return jsonb_build_object(
      'ok', false,
      'code', 'forbidden',
      'error', 'Solo un owner o admin puede editar el Project Model.'
    );
  end if;

  if jsonb_typeof(target_changes) <> 'array' then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_changes',
      'error', 'Los cambios manuales no tienen una estructura válida.'
    );
  end if;

  select
    count(*),
    coalesce(
      bool_and(
        change->>'category' = any(
          array[
            'requirement',
            'assumption',
            'domain_entity',
            'risk',
            'open_question',
            'model_status'
          ]
        )
        and change->>'operation' = any(array['add', 'update', 'remove'])
        and coalesce(change->>'entityKey', '') <> ''
        and coalesce(change->>'label', '') <> ''
        and (
          (change->>'operation' = 'add'
            and coalesce(change->'beforeValue', 'null'::jsonb) = 'null'::jsonb
            and coalesce(change->'afterValue', 'null'::jsonb) <> 'null'::jsonb)
          or (change->>'operation' = 'update'
            and coalesce(change->'beforeValue', 'null'::jsonb) <> 'null'::jsonb
            and coalesce(change->'afterValue', 'null'::jsonb) <> 'null'::jsonb)
          or (change->>'operation' = 'remove'
            and coalesce(change->'beforeValue', 'null'::jsonb) <> 'null'::jsonb
            and coalesce(change->'afterValue', 'null'::jsonb) = 'null'::jsonb)
        )
        and case
          when jsonb_typeof(change->'impactedArtifactTypes') = 'array'
          then
            jsonb_array_length(change->'impactedArtifactTypes') > 0
            and change->'impactedArtifactTypes' <@ '[
              "product_spec",
              "mvp_scope",
              "domain_model",
              "architecture",
              "data_model",
              "security",
              "backlog",
              "vertical_slice_plan"
            ]'::jsonb
          else false
        end
      ),
      false
    )
  into change_count, changes_valid
  from jsonb_array_elements(target_changes) as change;

  if change_count = 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'no_changes',
      'error', 'No se detectaron cambios respecto al modelo vigente.'
    );
  end if;

  if not changes_valid then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_changes',
      'error', 'Uno o más cambios manuales no son válidos.'
    );
  end if;

  perform 1
  from public.project_models
  where project_id = target_project_id
  for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'project_model_not_found',
      'error', 'No existe un Project Model vigente para editar.'
    );
  end if;

  select id
  into base_version_id
  from public.project_model_versions
  where project_id = target_project_id
  order by version_number desc
  limit 1;

  if target_base_model_version_id is distinct from base_version_id then
    return jsonb_build_object(
      'ok', false,
      'code', 'stale_editor',
      'error', 'El Project Model cambió mientras lo editabas. Recarga el editor y vuelve a aplicar tus cambios sobre la versión vigente.'
    );
  end if;

  insert into public.project_model_change_sets (
    project_id,
    source_type,
    base_model_version_id,
    title,
    summary,
    status,
    total_change_count,
    accepted_change_count,
    created_by
  )
  values (
    target_project_id,
    'manual',
    base_version_id,
    left(coalesce(nullif(target_title, ''), 'Edición manual del Project Model'), 240),
    coalesce(target_summary, '{}'::jsonb) || jsonb_build_object(
      'reason', left(coalesce(nullif(target_reason, ''), 'Manual Project Model edit'), 1000)
    ),
    'ready',
    change_count,
    change_count,
    auth.uid()
  )
  returning id into new_change_set_id;

  insert into public.project_model_changes (
    change_set_id,
    project_id,
    category,
    operation,
    entity_key,
    label,
    before_value,
    after_value,
    decision,
    reviewer_comment,
    reviewed_by,
    reviewed_at,
    impacted_artifact_types,
    display_order
  )
  select
    new_change_set_id,
    target_project_id,
    change->>'category',
    change->>'operation',
    change->>'entityKey',
    left(change->>'label', 500),
    nullif(change->'beforeValue', 'null'::jsonb),
    nullif(change->'afterValue', 'null'::jsonb),
    'accepted',
    left(coalesce(nullif(target_reason, ''), 'Manual Project Model edit'), 4000),
    auth.uid(),
    now(),
    change->'impactedArtifactTypes',
    ordinality::integer
  from jsonb_array_elements(target_changes)
    with ordinality as proposed(change, ordinality);

  select public.apply_project_model_change_set(
    new_change_set_id,
    target_model,
    target_artifacts,
    target_impacted_artifact_types
  ) into result;

  return result || jsonb_build_object(
    'changeSetId', new_change_set_id
  );
end;
$$;

create or replace function public.close_project_model_change_set(
  target_change_set_id uuid,
  target_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_set public.project_model_change_sets%rowtype;
  target_organization_id uuid;
  pending_count integer;
  accepted_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select *
  into selected_set
  from public.project_model_change_sets
  where id = target_change_set_id
  for update;

  if selected_set.id is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'change_set_not_found',
      'error', 'La propuesta de cambios no existe.'
    );
  end if;

  select organization_id
  into target_organization_id
  from public.projects
  where id = selected_set.project_id;

  if not public.is_org_admin(target_organization_id) then
    return jsonb_build_object(
      'ok', false,
      'code', 'forbidden',
      'error', 'Solo un owner o admin puede cerrar propuestas.'
    );
  end if;

  if selected_set.status in ('applied', 'rejected', 'cancelled') then
    return jsonb_build_object(
      'ok', false,
      'code', 'change_set_closed',
      'error', 'La propuesta ya está cerrada.'
    );
  end if;

  select
    count(*) filter (where decision = 'pending'),
    count(*) filter (where decision = 'accepted')
  into pending_count, accepted_count
  from public.project_model_changes
  where change_set_id = target_change_set_id;

  if pending_count > 0 or accepted_count > 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'cannot_close',
      'error', 'Solo puedes cerrar sin aplicar cuando todos los cambios fueron rechazados.'
    );
  end if;

  update public.project_model_change_sets
  set
    status = 'rejected',
    application_summary = jsonb_build_object(
      'closedWithoutApplying', true,
      'reason', nullif(target_reason, ''),
      'closedBy', auth.uid(),
      'closedAt', now()
    ),
    updated_at = now()
  where id = target_change_set_id;

  if selected_set.source_review_id is not null then
    update public.agent_run_reviews
    set
      application_status = 'not_applicable',
      application_summary = jsonb_build_object(
        'changeSetId', target_change_set_id,
        'allChangesRejected', true,
        'reason', nullif(target_reason, '')
      ),
      updated_at = now()
    where id = selected_set.source_review_id;
  end if;

  if selected_set.source_run_id is not null then
    insert into public.agent_run_events (
      run_id,
      event_type,
      payload
    )
    values (
      selected_set.source_run_id,
      'change_set_rejected',
      jsonb_build_object(
        'changeSetId', target_change_set_id,
        'reason', nullif(target_reason, ''),
        'closedBy', auth.uid()
      )
    );
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.apply_approved_project_model_run(uuid, uuid, jsonb, jsonb) from authenticated;

revoke all on function public.create_project_model_change_set(uuid, uuid, text, jsonb, jsonb) from public;
revoke all on function public.review_project_model_change(uuid, uuid, text, text) from public;
revoke all on function public.apply_project_model_change_set(uuid, jsonb, jsonb, text[]) from public;
revoke all on function public.create_and_apply_manual_project_model_change_set(uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb, text[]) from public;
revoke all on function public.close_project_model_change_set(uuid, text) from public;

grant execute on function public.create_project_model_change_set(uuid, uuid, text, jsonb, jsonb) to authenticated;
grant execute on function public.review_project_model_change(uuid, uuid, text, text) to authenticated;
grant execute on function public.apply_project_model_change_set(uuid, jsonb, jsonb, text[]) to authenticated;
grant execute on function public.create_and_apply_manual_project_model_change_set(uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb, text[]) to authenticated;
grant execute on function public.close_project_model_change_set(uuid, text) to authenticated;

commit;
