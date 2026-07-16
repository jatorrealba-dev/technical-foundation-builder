begin;

alter table public.agent_run_reviews
  drop constraint if exists
    agent_run_reviews_application_status_valid;

alter table public.agent_run_reviews
  add constraint
    agent_run_reviews_application_status_valid
  check (
    application_status in (
      'not_applied',
      'applying',
      'applied',
      'failed',
      'not_applicable'
    )
  );

alter table public.agent_run_reviews
  drop constraint if exists
    agent_run_reviews_decision_application_consistent;

alter table public.agent_run_reviews
  add constraint
    agent_run_reviews_decision_application_consistent
  check (
    application_status in (
      'not_applied',
      'not_applicable'
    )
    or decision = 'approved'
  );

create table if not exists public.project_model_versions (
  id uuid primary key default gen_random_uuid(),
  project_model_id uuid not null
    references public.project_models(id)
    on delete cascade,
  project_id uuid not null
    references public.projects(id)
    on delete cascade,
  version_number integer not null,
  status text not null,
  requirements jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  domain_entities jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  open_questions jsonb not null default '[]'::jsonb,
  source_run_id uuid
    references public.agent_runs(id)
    on delete set null,
  source_review_id uuid
    references public.agent_run_reviews(id)
    on delete set null,
  restored_from_version_id uuid
    references public.project_model_versions(id)
    on delete set null,
  change_reason text not null default 'Project Model updated',
  created_by uuid
    references auth.users(id)
    on delete set null,
  created_at timestamptz not null default now(),

  constraint project_model_versions_number_positive
    check (version_number > 0),

  constraint project_model_versions_project_version_unique
    unique (project_id, version_number)
);

create index if not exists
  idx_project_model_versions_project_created_at
on public.project_model_versions (
  project_id,
  created_at desc
);

create index if not exists
  idx_project_model_versions_source_run
on public.project_model_versions (source_run_id)
where source_run_id is not null;

comment on table public.project_model_versions is
  'Immutable snapshots of every persisted Project Model state.';

comment on column public.project_model_versions.source_run_id is
  'AI agent run that originated this version, when applicable.';

comment on column public.project_model_versions.restored_from_version_id is
  'Historical Project Model version restored to create this new version.';

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
  configured_restored_version text;
  configured_reason text;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(new.project_id::text, 0)
  );

  select
    coalesce(max(version_number), 0) + 1
  into next_version_number
  from public.project_model_versions
  where project_id = new.project_id;

  configured_source_run :=
    current_setting('app.source_run_id', true);

  configured_source_review :=
    current_setting('app.source_review_id', true);

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
  change_reason,
  created_by,
  created_at
)
select
  project_models.id,
  project_models.project_id,
  1,
  project_models.status,
  project_models.requirements,
  project_models.assumptions,
  project_models.domain_entities,
  project_models.risks,
  project_models.open_questions,
  'Initial Project Model history backfill',
  null,
  project_models.updated_at
from public.project_models
where not exists (
  select 1
  from public.project_model_versions
  where project_model_versions.project_id =
    project_models.project_id
);

drop trigger if exists
  capture_project_model_version_on_write
on public.project_models;

create trigger capture_project_model_version_on_write
after insert
or update of
  status,
  requirements,
  assumptions,
  domain_entities,
  risks,
  open_questions
on public.project_models
for each row
execute function public.capture_project_model_version();

alter table public.project_model_versions
  enable row level security;

drop policy if exists
  "Members can read Project Model versions for accessible projects"
on public.project_model_versions;

create policy
  "Members can read Project Model versions for accessible projects"
on public.project_model_versions
for select
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id =
      project_model_versions.project_id
      and public.is_org_member(
        projects.organization_id
      )
  )
);

revoke all privileges
on table public.project_model_versions
from anon;

revoke all privileges
on table public.project_model_versions
from authenticated;

grant select
on table public.project_model_versions
to authenticated;

create or replace function public.apply_approved_project_model_run(
  target_project_id uuid,
  target_run_id uuid,
  target_model jsonb,
  target_artifacts jsonb
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
  artifact_count integer;
  distinct_artifact_count integer;
  artifact_types_valid boolean;
  current_generated_at timestamptz;
  new_model_version integer;
  applied_at timestamptz := now();
  result_summary jsonb;
  failure_message text;
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
      'error', 'Solo un owner o admin puede aplicar resultados de IA.'
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

  select *
  into selected_review
  from public.agent_run_reviews
  where run_id = target_run_id
    and project_id = target_project_id
  for update;

  if selected_review.id is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'review_not_found',
      'error', 'No existe el registro de revisión para esta ejecución.'
    );
  end if;

  if selected_review.decision <> 'approved' then
    return jsonb_build_object(
      'ok', false,
      'code', 'review_not_approved',
      'error', 'La ejecución debe estar aprobada antes de aplicarse.'
    );
  end if;

  if selected_review.application_status = 'applied' then
    return jsonb_build_object(
      'ok', false,
      'code', 'already_applied',
      'error', 'Las recomendaciones de esta ejecución ya fueron aplicadas.'
    );
  end if;

  if selected_review.application_status = 'applying' then
    return jsonb_build_object(
      'ok', false,
      'code', 'application_in_progress',
      'error', 'La aplicación de esta ejecución ya está en progreso.'
    );
  end if;

  if jsonb_typeof(target_model) <> 'object'
    or jsonb_typeof(target_model->'requirements') <> 'array'
    or jsonb_typeof(target_model->'assumptions') <> 'array'
    or jsonb_typeof(target_model->'domainEntities') <> 'array'
    or jsonb_typeof(target_model->'risks') <> 'array'
    or jsonb_typeof(target_model->'openQuestions') <> 'array'
  then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_model_payload',
      'error', 'El Project Model propuesto no tiene una estructura válida.'
    );
  end if;

  if jsonb_typeof(target_artifacts) <> 'array' then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_artifact_payload',
      'error', 'El paquete documental propuesto no es válido.'
    );
  end if;

  select
    count(*),
    count(distinct artifact->>'type'),
    coalesce(
      bool_and(
        artifact->>'type' = any(
          array[
            'product_spec',
            'mvp_scope',
            'domain_model',
            'architecture',
            'data_model',
            'security',
            'backlog',
            'vertical_slice_plan'
          ]
        )
        and coalesce(artifact->>'title', '') <> ''
        and coalesce(artifact->>'filename', '') <> ''
        and artifact->>'format' = 'markdown'
        and coalesce(artifact->>'content', '') <> ''
      ),
      false
    )
  into
    artifact_count,
    distinct_artifact_count,
    artifact_types_valid
  from jsonb_array_elements(target_artifacts)
    as artifact;

  if artifact_count <> 8
    or distinct_artifact_count <> 8
    or not artifact_types_valid
  then
    return jsonb_build_object(
      'ok', false,
      'code', 'incomplete_artifact_payload',
      'error', 'La aplicación requiere exactamente los ocho documentos válidos.'
    );
  end if;

  update public.agent_run_reviews
  set
    application_status = 'applying',
    application_summary = jsonb_build_object(
      'target', 'project_models',
      'startedAt', applied_at
    ),
    updated_at = applied_at
  where id = selected_review.id;

  insert into public.agent_run_events (
    run_id,
    event_type,
    payload,
    created_at
  )
  values (
    target_run_id,
    'run_application_started',
    jsonb_build_object(
      'startedBy', auth.uid(),
      'startedAt', applied_at
    ),
    applied_at
  );

  begin
    perform set_config(
      'app.source_run_id',
      target_run_id::text,
      true
    );

    perform set_config(
      'app.source_review_id',
      selected_review.id::text,
      true
    );

    perform set_config(
      'app.project_model_change_reason',
      'Applied approved Project Model Analyst run',
      true
    );

    select generated_at
    into current_generated_at
    from public.project_models
    where project_id = target_project_id;

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
      target_project_id,
      'approved',
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
      target_project_id,
      artifact->>'type',
      artifact->>'title',
      artifact->>'filename',
      artifact->>'format',
      artifact->>'content',
      applied_at
    from jsonb_array_elements(target_artifacts)
      as artifact
    on conflict (project_id, type)
    do update set
      title = excluded.title,
      filename = excluded.filename,
      format = excluded.format,
      content = excluded.content,
      updated_at = excluded.updated_at;

    update public.projects
    set
      status = 'package_generated',
      updated_at = applied_at
    where id = target_project_id;

    select max(version_number)
    into new_model_version
    from public.project_model_versions
    where project_id = target_project_id;

    result_summary := jsonb_build_object(
      'target', 'project_models',
      'projectModelUpdated', true,
      'projectModelVersion', new_model_version,
      'documentsRegenerated', true,
      'regeneratedArtifactCount', artifact_count,
      'requirements', jsonb_array_length(
        target_model->'requirements'
      ),
      'assumptions', jsonb_array_length(
        target_model->'assumptions'
      ),
      'domainEntities', jsonb_array_length(
        target_model->'domainEntities'
      ),
      'risks', jsonb_array_length(
        target_model->'risks'
      ),
      'openQuestions', jsonb_array_length(
        target_model->'openQuestions'
      ),
      'appliedAt', applied_at
    );
  exception
    when others then
      failure_message := sqlerrm;

      update public.agent_run_reviews
      set
        application_status = 'failed',
        application_summary = jsonb_build_object(
          'target', 'project_models',
          'projectModelUpdated', false,
          'documentsRegenerated', false,
          'error', failure_message,
          'failedAt', now()
        ),
        updated_at = now()
      where id = selected_review.id;

      insert into public.agent_run_events (
        run_id,
        event_type,
        payload
      )
      values (
        target_run_id,
        'run_application_failed',
        jsonb_build_object(
          'projectModelUpdated', false,
          'documentsRegenerated', false,
          'error', failure_message
        )
      );

      return jsonb_build_object(
        'ok', false,
        'code', 'transaction_failed',
        'error', failure_message
      );
  end;

  update public.agent_run_reviews
  set
    application_status = 'applied',
    application_summary = result_summary,
    applied_by = auth.uid(),
    applied_at = applied_at,
    updated_at = applied_at
  where id = selected_review.id;

  insert into public.agent_run_events (
    run_id,
    event_type,
    payload,
    created_at
  )
  values (
    target_run_id,
    'run_applied',
    result_summary,
    applied_at
  );

  return jsonb_build_object(
    'ok', true,
    'summary', result_summary
  );
end;
$$;

revoke all
on function public.apply_approved_project_model_run(
  uuid,
  uuid,
  jsonb,
  jsonb
)
from public;

grant execute
on function public.apply_approved_project_model_run(
  uuid,
  uuid,
  jsonb,
  jsonb
)
to authenticated;

create or replace function public.restore_project_model_version(
  target_project_id uuid,
  target_version_id uuid,
  target_artifacts jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_organization_id uuid;
  selected_version public.project_model_versions%rowtype;
  artifact_count integer;
  distinct_artifact_count integer;
  artifact_types_valid boolean;
  restored_at timestamptz := now();
  new_model_version integer;
  failure_message text;
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
      'error', 'Solo un owner o admin puede restaurar el Project Model.'
    );
  end if;

  select *
  into selected_version
  from public.project_model_versions
  where id = target_version_id
    and project_id = target_project_id;

  if selected_version.id is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'version_not_found',
      'error', 'La versión seleccionada no existe o no pertenece al proyecto.'
    );
  end if;

  if jsonb_typeof(target_artifacts) <> 'array' then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_artifact_payload',
      'error', 'El paquete documental propuesto no es válido.'
    );
  end if;

  select
    count(*),
    count(distinct artifact->>'type'),
    coalesce(
      bool_and(
        artifact->>'type' = any(
          array[
            'product_spec',
            'mvp_scope',
            'domain_model',
            'architecture',
            'data_model',
            'security',
            'backlog',
            'vertical_slice_plan'
          ]
        )
        and coalesce(artifact->>'content', '') <> ''
      ),
      false
    )
  into
    artifact_count,
    distinct_artifact_count,
    artifact_types_valid
  from jsonb_array_elements(target_artifacts)
    as artifact;

  if artifact_count <> 8
    or distinct_artifact_count <> 8
    or not artifact_types_valid
  then
    return jsonb_build_object(
      'ok', false,
      'code', 'incomplete_artifact_payload',
      'error', 'La restauración requiere exactamente los ocho documentos válidos.'
    );
  end if;

  perform 1
  from public.project_models
  where project_id = target_project_id
  for update;

  begin
    perform set_config(
      'app.source_run_id',
      '',
      true
    );

    perform set_config(
      'app.source_review_id',
      '',
      true
    );

    perform set_config(
      'app.restored_from_project_model_version_id',
      target_version_id::text,
      true
    );

    perform set_config(
      'app.project_model_change_reason',
      'Restored Project Model version '
        || selected_version.version_number::text,
      true
    );

    update public.project_models
    set
      status = selected_version.status,
      requirements = selected_version.requirements,
      assumptions = selected_version.assumptions,
      domain_entities = selected_version.domain_entities,
      risks = selected_version.risks,
      open_questions = selected_version.open_questions,
      updated_at = restored_at
    where project_id = target_project_id;

    if not found then
      raise exception 'The active Project Model no longer exists.';
    end if;

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
      target_project_id,
      artifact->>'type',
      artifact->>'title',
      artifact->>'filename',
      artifact->>'format',
      artifact->>'content',
      restored_at
    from jsonb_array_elements(target_artifacts)
      as artifact
    on conflict (project_id, type)
    do update set
      title = excluded.title,
      filename = excluded.filename,
      format = excluded.format,
      content = excluded.content,
      updated_at = excluded.updated_at;

    update public.projects
    set
      status = 'package_generated',
      updated_at = restored_at
    where id = target_project_id;

    select max(version_number)
    into new_model_version
    from public.project_model_versions
    where project_id = target_project_id;
  exception
    when others then
      failure_message := sqlerrm;

      return jsonb_build_object(
        'ok', false,
        'code', 'transaction_failed',
        'error', failure_message
      );
  end;

  return jsonb_build_object(
    'ok', true,
    'restoredFromVersion',
      selected_version.version_number,
    'newVersion', new_model_version,
    'regeneratedArtifactCount', artifact_count,
    'restoredAt', restored_at
  );
end;
$$;

revoke all
on function public.restore_project_model_version(
  uuid,
  uuid,
  jsonb
)
from public;

grant execute
on function public.restore_project_model_version(
  uuid,
  uuid,
  jsonb
)
to authenticated;

commit;
