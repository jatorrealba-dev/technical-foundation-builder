begin;

create table if not exists public.artifact_versions (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null
    references public.artifacts(id)
    on delete cascade,
  version_number integer not null,
  title text not null,
  filename text not null,
  format text not null default 'markdown',
  content text not null,
  source_snapshot jsonb not null default '{}'::jsonb,
  generated_by uuid
    references auth.users(id)
    on delete set null,
  created_at timestamptz not null default now(),

  constraint artifact_versions_version_number_positive
    check (version_number > 0),

  constraint artifact_versions_artifact_version_unique
    unique (artifact_id, version_number)
);

create index if not exists
  idx_artifact_versions_artifact_created_at
on public.artifact_versions (
  artifact_id,
  created_at desc
);

create index if not exists
  idx_artifact_versions_generated_by
on public.artifact_versions (generated_by)
where generated_by is not null;

comment on table public.artifact_versions is
  'Immutable history of generated artifact versions.';

comment on column public.artifact_versions.source_snapshot is
  'Snapshot of the project and Project Model used to generate this version.';

comment on column public.artifact_versions.generated_by is
  'Authenticated user responsible for the generation. Null means the actor is unknown or the version was backfilled.';

create or replace function public.build_artifact_source_snapshot(
  target_project_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'captured_at',
    now(),
    'project',
    to_jsonb(projects),
    'project_model',
    case
      when project_models.project_id is null then null
      else to_jsonb(project_models)
    end
  )
  from public.projects
  left join public.project_models
    on project_models.project_id = projects.id
  where projects.id = target_project_id;
$$;

revoke all
on function public.build_artifact_source_snapshot(uuid)
from public;

create or replace function public.capture_artifact_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_version_number integer;
begin
  perform pg_advisory_xact_lock(
    hashtextextended(new.id::text, 0)
  );

  select
    coalesce(max(artifact_versions.version_number), 0) + 1
  into next_version_number
  from public.artifact_versions
  where artifact_versions.artifact_id = new.id;

  insert into public.artifact_versions (
    artifact_id,
    version_number,
    title,
    filename,
    format,
    content,
    source_snapshot,
    generated_by,
    created_at
  )
  values (
    new.id,
    next_version_number,
    new.title,
    new.filename,
    new.format,
    new.content,
    coalesce(
      public.build_artifact_source_snapshot(
        new.project_id
      ),
      '{}'::jsonb
    ),
    auth.uid(),
    new.updated_at
  );

  return new;
end;
$$;

revoke all
on function public.capture_artifact_version()
from public;

insert into public.artifact_versions (
  artifact_id,
  version_number,
  title,
  filename,
  format,
  content,
  source_snapshot,
  generated_by,
  created_at
)
select
  artifacts.id,
  1,
  artifacts.title,
  artifacts.filename,
  artifacts.format,
  artifacts.content,
  coalesce(
    public.build_artifact_source_snapshot(
      artifacts.project_id
    ),
    '{}'::jsonb
  ),
  null,
  artifacts.updated_at
from public.artifacts
where not exists (
  select 1
  from public.artifact_versions
  where artifact_versions.artifact_id =
    artifacts.id
);

drop trigger if exists
  capture_artifact_version_on_write
on public.artifacts;

create trigger capture_artifact_version_on_write
after insert
or update of title, filename, format, content
on public.artifacts
for each row
execute function public.capture_artifact_version();

alter table public.artifact_versions
enable row level security;

drop policy if exists
  "Users can read artifact versions for accessible projects"
on public.artifact_versions;

create policy
  "Users can read artifact versions for accessible projects"
on public.artifact_versions
for select
to authenticated
using (
  exists (
    select 1
    from public.artifacts
    join public.projects
      on projects.id = artifacts.project_id
    where artifacts.id =
      artifact_versions.artifact_id
      and public.is_org_member(
        projects.organization_id
      )
  )
);

revoke all privileges
on table public.artifact_versions
from anon;

revoke all privileges
on table public.artifact_versions
from authenticated;

grant select
on table public.artifact_versions
to authenticated;

commit;
