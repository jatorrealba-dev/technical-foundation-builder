begin;

create table if not exists public.consistency_scans (
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
  status text not null default 'completed',
  summary jsonb not null default '{}'::jsonb,
  finding_count integer not null default 0,
  critical_count integer not null default 0,
  high_count integer not null default 0,
  medium_count integer not null default 0,
  low_count integer not null default 0,
  info_count integer not null default 0,
  created_by uuid
    references auth.users(id)
    on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),

  constraint consistency_scans_source_valid
    check (source in ('deterministic', 'agent')),

  constraint consistency_scans_status_valid
    check (status in ('completed', 'failed')),

  constraint consistency_scans_counts_non_negative
    check (
      finding_count >= 0
      and critical_count >= 0
      and high_count >= 0
      and medium_count >= 0
      and low_count >= 0
      and info_count >= 0
    ),

  constraint consistency_scans_count_sum_valid
    check (
      finding_count =
        critical_count + high_count + medium_count + low_count + info_count
    ),

  constraint consistency_scans_model_version_positive
    check (
      project_model_version_number is null
      or project_model_version_number > 0
    ),

  constraint consistency_scans_model_version_consistent
    check (
      (project_model_version_id is null and project_model_version_number is null)
      or (project_model_version_id is not null and project_model_version_number is not null)
    ),

  constraint consistency_scans_source_run_consistent
    check (
      (source = 'deterministic' and source_run_id is null)
      or (source = 'agent' and source_run_id is not null)
    )
);

create unique index if not exists
  idx_consistency_scans_source_run_unique
on public.consistency_scans (source_run_id)
where source_run_id is not null;

create index if not exists
  idx_consistency_scans_project_created_at
on public.consistency_scans (project_id, created_at desc);

create table if not exists public.consistency_findings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null
    references public.projects(id)
    on delete cascade,
  fingerprint text not null,
  rule_key text not null,
  last_source text not null,
  last_source_run_id uuid
    references public.agent_runs(id)
    on delete set null,
  severity text not null,
  category text not null,
  title text not null,
  description text not null,
  evidence jsonb not null default '[]'::jsonb,
  affected_artifact_types jsonb not null default '[]'::jsonb,
  recommendation text not null,
  status text not null default 'open',
  resolution_comment text,
  first_scan_id uuid not null
    references public.consistency_scans(id)
    on delete restrict,
  last_scan_id uuid not null
    references public.consistency_scans(id)
    on delete restrict,
  occurrence_count integer not null default 1,
  reviewed_by uuid
    references auth.users(id)
    on delete set null,
  reviewed_at timestamptz,
  resolved_by uuid
    references auth.users(id)
    on delete set null,
  resolved_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint consistency_findings_project_fingerprint_unique
    unique (project_id, fingerprint),

  constraint consistency_findings_fingerprint_not_empty
    check (char_length(trim(fingerprint)) > 0),

  constraint consistency_findings_rule_key_not_empty
    check (char_length(trim(rule_key)) > 0),

  constraint consistency_findings_source_valid
    check (last_source in ('deterministic', 'agent')),

  constraint consistency_findings_severity_valid
    check (severity in ('info', 'low', 'medium', 'high', 'critical')),

  constraint consistency_findings_category_valid
    check (
      category in (
        'requirement_gap',
        'domain_gap',
        'data_gap',
        'security_gap',
        'architecture_gap',
        'delivery_gap',
        'contradiction',
        'stale_artifact'
      )
    ),

  constraint consistency_findings_status_valid
    check (status in ('open', 'accepted', 'dismissed', 'resolved')),

  constraint consistency_findings_occurrence_positive
    check (occurrence_count > 0),

  constraint consistency_findings_evidence_array
    check (jsonb_typeof(evidence) = 'array'),

  constraint consistency_findings_artifacts_array
    check (
      jsonb_typeof(affected_artifact_types) = 'array'
      and affected_artifact_types <@ '[
        "product_spec",
        "mvp_scope",
        "domain_model",
        "architecture",
        "data_model",
        "security",
        "backlog",
        "vertical_slice_plan"
      ]'::jsonb
    ),

  constraint consistency_findings_comment_length
    check (
      resolution_comment is null
      or char_length(resolution_comment) <= 4000
    ),

  constraint consistency_findings_resolution_metadata
    check (
      (status = 'resolved' and resolved_by is not null and resolved_at is not null)
      or (status <> 'resolved' and resolved_by is null and resolved_at is null)
    )
);

create index if not exists
  idx_consistency_findings_project_status_severity
on public.consistency_findings (
  project_id,
  status,
  severity,
  last_seen_at desc
);

create index if not exists
  idx_consistency_findings_project_category
on public.consistency_findings (
  project_id,
  category,
  last_seen_at desc
);

create table if not exists public.consistency_scan_findings (
  scan_id uuid not null
    references public.consistency_scans(id)
    on delete cascade,
  finding_id uuid not null
    references public.consistency_findings(id)
    on delete cascade,
  severity text not null,
  category text not null,
  title text not null,
  description text not null,
  evidence jsonb not null default '[]'::jsonb,
  affected_artifact_types jsonb not null default '[]'::jsonb,
  recommendation text not null,
  created_at timestamptz not null default now(),

  primary key (scan_id, finding_id),

  constraint consistency_scan_findings_severity_valid
    check (severity in ('info', 'low', 'medium', 'high', 'critical')),

  constraint consistency_scan_findings_category_valid
    check (
      category in (
        'requirement_gap',
        'domain_gap',
        'data_gap',
        'security_gap',
        'architecture_gap',
        'delivery_gap',
        'contradiction',
        'stale_artifact'
      )
    ),

  constraint consistency_scan_findings_evidence_array
    check (jsonb_typeof(evidence) = 'array'),

  constraint consistency_scan_findings_artifacts_array
    check (
      jsonb_typeof(affected_artifact_types) = 'array'
      and affected_artifact_types <@ '[
        "product_spec",
        "mvp_scope",
        "domain_model",
        "architecture",
        "data_model",
        "security",
        "backlog",
        "vertical_slice_plan"
      ]'::jsonb
    )
);

create index if not exists
  idx_consistency_scan_findings_finding
on public.consistency_scan_findings (finding_id, created_at desc);

create table if not exists public.consistency_finding_events (
  id uuid primary key default gen_random_uuid(),
  finding_id uuid not null
    references public.consistency_findings(id)
    on delete cascade,
  project_id uuid not null
    references public.projects(id)
    on delete cascade,
  event_type text not null,
  status_from text,
  status_to text,
  comment text,
  actor_id uuid
    references auth.users(id)
    on delete set null,
  scan_id uuid
    references public.consistency_scans(id)
    on delete set null,
  created_at timestamptz not null default now(),

  constraint consistency_finding_events_type_valid
    check (event_type in ('created', 'seen_again', 'reopened_by_scan', 'status_changed')),

  constraint consistency_finding_events_status_from_valid
    check (
      status_from is null
      or status_from in ('open', 'accepted', 'dismissed', 'resolved')
    ),

  constraint consistency_finding_events_status_to_valid
    check (
      status_to is null
      or status_to in ('open', 'accepted', 'dismissed', 'resolved')
    ),

  constraint consistency_finding_events_comment_length
    check (comment is null or char_length(comment) <= 4000)
);

create index if not exists
  idx_consistency_finding_events_finding_created_at
on public.consistency_finding_events (finding_id, created_at desc);

comment on table public.consistency_scans is
  'Immutable executions of deterministic or AI-assisted consistency analysis.';

comment on table public.consistency_findings is
  'Deduplicated, reviewable consistency findings that persist across scans.';

comment on table public.consistency_scan_findings is
  'Immutable snapshot of every finding observed in a consistency scan.';

comment on table public.consistency_finding_events is
  'Audit trail for finding creation, recurrence, reopening, and human status decisions.';

alter table public.consistency_scans enable row level security;
alter table public.consistency_findings enable row level security;
alter table public.consistency_scan_findings enable row level security;
alter table public.consistency_finding_events enable row level security;

drop policy if exists
  "Members can read consistency scans"
on public.consistency_scans;

create policy
  "Members can read consistency scans"
on public.consistency_scans
for select
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = consistency_scans.project_id
      and public.is_org_member(projects.organization_id)
  )
);

drop policy if exists
  "Members can read consistency findings"
on public.consistency_findings;

create policy
  "Members can read consistency findings"
on public.consistency_findings
for select
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = consistency_findings.project_id
      and public.is_org_member(projects.organization_id)
  )
);

drop policy if exists
  "Members can read consistency scan findings"
on public.consistency_scan_findings;

create policy
  "Members can read consistency scan findings"
on public.consistency_scan_findings
for select
to authenticated
using (
  exists (
    select 1
    from public.consistency_scans
    join public.projects
      on projects.id = consistency_scans.project_id
    where consistency_scans.id = consistency_scan_findings.scan_id
      and public.is_org_member(projects.organization_id)
  )
);

drop policy if exists
  "Members can read consistency finding events"
on public.consistency_finding_events;

create policy
  "Members can read consistency finding events"
on public.consistency_finding_events
for select
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = consistency_finding_events.project_id
      and public.is_org_member(projects.organization_id)
  )
);

revoke all privileges on table public.consistency_scans from anon;
revoke all privileges on table public.consistency_scans from authenticated;
revoke all privileges on table public.consistency_findings from anon;
revoke all privileges on table public.consistency_findings from authenticated;
revoke all privileges on table public.consistency_scan_findings from anon;
revoke all privileges on table public.consistency_scan_findings from authenticated;
revoke all privileges on table public.consistency_finding_events from anon;
revoke all privileges on table public.consistency_finding_events from authenticated;

grant select on table public.consistency_scans to authenticated;
grant select on table public.consistency_findings to authenticated;
grant select on table public.consistency_scan_findings to authenticated;
grant select on table public.consistency_finding_events to authenticated;

create or replace function public.record_consistency_scan(
  target_project_id uuid,
  target_source text,
  target_source_run_id uuid,
  target_model_version_id uuid,
  target_model_version_number integer,
  target_summary jsonb,
  target_findings jsonb
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
  existing_scan_id uuid;
  new_scan_id uuid;
  finding_item jsonb;
  existing_finding public.consistency_findings%rowtype;
  current_finding_id uuid;
  previous_status text;
  next_status text;
  finding_count integer;
  distinct_fingerprint_count integer;
  critical_count integer;
  high_count integer;
  medium_count integer;
  low_count integer;
  info_count integer;
  findings_valid boolean;
  validated_model_version_number integer;
  observed_at timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if target_source not in ('deterministic', 'agent') then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_source',
      'error', 'La fuente del análisis de consistencia no es válida.'
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

  if jsonb_typeof(target_findings) <> 'array' then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_findings',
      'error', 'Los hallazgos no tienen una estructura válida.'
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
        'error', 'La versión del Project Model no pertenece al proyecto o no coincide con su número.'
      );
    end if;
  end if;

  if target_source = 'deterministic' and target_source_run_id is not null then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_source_run',
      'error', 'Un análisis determinista no puede asociarse a una ejecución de IA.'
    );
  end if;

  if target_source = 'agent' then
    if target_source_run_id is null then
      return jsonb_build_object(
        'ok', false,
        'code', 'run_required',
        'error', 'La ejecución de Consistency Reviewer es obligatoria.'
      );
    end if;

    select *
    into selected_run
    from public.agent_runs
    where id = target_source_run_id
      and project_id = target_project_id;

    if selected_run.id is null
      or selected_run.agent_key <> 'consistency'
      or selected_run.status <> 'completed'
      or selected_run.output is null
    then
      return jsonb_build_object(
        'ok', false,
        'code', 'invalid_run',
        'error', 'La ejecución no es un Consistency Reviewer completado.'
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
        'code', 'review_not_approved',
        'error', 'La ejecución debe estar aprobada antes de importar sus hallazgos.'
      );
    end if;

    select id
    into existing_scan_id
    from public.consistency_scans
    where source_run_id = target_source_run_id;

    if existing_scan_id is not null then
      return jsonb_build_object(
        'ok', true,
        'scanId', existing_scan_id,
        'existing', true
      );
    end if;
  end if;

  select
    count(*),
    count(distinct finding->>'fingerprint'),
    count(*) filter (where finding->>'severity' = 'critical'),
    count(*) filter (where finding->>'severity' = 'high'),
    count(*) filter (where finding->>'severity' = 'medium'),
    count(*) filter (where finding->>'severity' = 'low'),
    count(*) filter (where finding->>'severity' = 'info'),
    coalesce(
      bool_and(
        coalesce(finding->>'fingerprint', '') <> ''
        and coalesce(finding->>'ruleKey', '') <> ''
        and finding->>'source' = target_source
        and finding->>'severity' = any(
          array['info', 'low', 'medium', 'high', 'critical']
        )
        and finding->>'category' = any(
          array[
            'requirement_gap',
            'domain_gap',
            'data_gap',
            'security_gap',
            'architecture_gap',
            'delivery_gap',
            'contradiction',
            'stale_artifact'
          ]
        )
        and coalesce(finding->>'title', '') <> ''
        and coalesce(finding->>'description', '') <> ''
        and jsonb_typeof(finding->'evidence') = 'array'
        and jsonb_typeof(finding->'affectedArtifactTypes') = 'array'
        and finding->'affectedArtifactTypes' <@ '[
          "product_spec",
          "mvp_scope",
          "domain_model",
          "architecture",
          "data_model",
          "security",
          "backlog",
          "vertical_slice_plan"
        ]'::jsonb
        and coalesce(finding->>'recommendation', '') <> ''
      ),
      true
    )
  into
    finding_count,
    distinct_fingerprint_count,
    critical_count,
    high_count,
    medium_count,
    low_count,
    info_count,
    findings_valid
  from jsonb_array_elements(target_findings) as proposed(finding);

  if not findings_valid
    or distinct_fingerprint_count <> finding_count
  then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_findings',
      'error', 'Uno o más hallazgos son inválidos o están duplicados.'
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_project_id::text || ':consistency', 0)
  );

  if target_source = 'agent' then
    select id
    into existing_scan_id
    from public.consistency_scans
    where source_run_id = target_source_run_id;

    if existing_scan_id is not null then
      return jsonb_build_object(
        'ok', true,
        'scanId', existing_scan_id,
        'existing', true
      );
    end if;
  end if;

  insert into public.consistency_scans (
    project_id,
    source,
    source_run_id,
    project_model_version_id,
    project_model_version_number,
    status,
    summary,
    finding_count,
    critical_count,
    high_count,
    medium_count,
    low_count,
    info_count,
    created_by,
    completed_at,
    created_at
  )
  values (
    target_project_id,
    target_source,
    target_source_run_id,
    target_model_version_id,
    target_model_version_number,
    'completed',
    coalesce(target_summary, '{}'::jsonb),
    finding_count,
    critical_count,
    high_count,
    medium_count,
    low_count,
    info_count,
    auth.uid(),
    observed_at,
    observed_at
  )
  returning id into new_scan_id;

  for finding_item in
    select value
    from jsonb_array_elements(target_findings)
  loop
    select *
    into existing_finding
    from public.consistency_findings
    where project_id = target_project_id
      and fingerprint = finding_item->>'fingerprint'
    for update;

    if existing_finding.id is null then
      insert into public.consistency_findings (
        project_id,
        fingerprint,
        rule_key,
        last_source,
        last_source_run_id,
        severity,
        category,
        title,
        description,
        evidence,
        affected_artifact_types,
        recommendation,
        status,
        first_scan_id,
        last_scan_id,
        occurrence_count,
        first_seen_at,
        last_seen_at,
        created_at,
        updated_at
      )
      values (
        target_project_id,
        finding_item->>'fingerprint',
        finding_item->>'ruleKey',
        target_source,
        target_source_run_id,
        finding_item->>'severity',
        finding_item->>'category',
        left(finding_item->>'title', 500),
        finding_item->>'description',
        finding_item->'evidence',
        finding_item->'affectedArtifactTypes',
        finding_item->>'recommendation',
        'open',
        new_scan_id,
        new_scan_id,
        1,
        observed_at,
        observed_at,
        observed_at,
        observed_at
      )
      returning id into current_finding_id;

      insert into public.consistency_finding_events (
        finding_id,
        project_id,
        event_type,
        status_to,
        actor_id,
        scan_id
      )
      values (
        current_finding_id,
        target_project_id,
        'created',
        'open',
        auth.uid(),
        new_scan_id
      );
    else
      current_finding_id := existing_finding.id;
      previous_status := existing_finding.status;
      next_status := case
        when existing_finding.status = 'resolved' then 'open'
        else existing_finding.status
      end;

      update public.consistency_findings
      set
        rule_key = finding_item->>'ruleKey',
        last_source = target_source,
        last_source_run_id = target_source_run_id,
        severity = finding_item->>'severity',
        category = finding_item->>'category',
        title = left(finding_item->>'title', 500),
        description = finding_item->>'description',
        evidence = finding_item->'evidence',
        affected_artifact_types = finding_item->'affectedArtifactTypes',
        recommendation = finding_item->>'recommendation',
        status = next_status,
        resolution_comment = case
          when next_status = 'open' and previous_status = 'resolved'
          then null
          else resolution_comment
        end,
        resolved_by = case
          when next_status = 'open' and previous_status = 'resolved'
          then null
          else resolved_by
        end,
        resolved_at = case
          when next_status = 'open' and previous_status = 'resolved'
          then null
          else resolved_at
        end,
        last_scan_id = new_scan_id,
        occurrence_count = occurrence_count + 1,
        last_seen_at = observed_at,
        updated_at = observed_at
      where id = existing_finding.id;

      insert into public.consistency_finding_events (
        finding_id,
        project_id,
        event_type,
        status_from,
        status_to,
        actor_id,
        scan_id
      )
      values (
        current_finding_id,
        target_project_id,
        case
          when previous_status = 'resolved'
          then 'reopened_by_scan'
          else 'seen_again'
        end,
        previous_status,
        next_status,
        auth.uid(),
        new_scan_id
      );
    end if;

    insert into public.consistency_scan_findings (
      scan_id,
      finding_id,
      severity,
      category,
      title,
      description,
      evidence,
      affected_artifact_types,
      recommendation,
      created_at
    )
    values (
      new_scan_id,
      current_finding_id,
      finding_item->>'severity',
      finding_item->>'category',
      left(finding_item->>'title', 500),
      finding_item->>'description',
      finding_item->'evidence',
      finding_item->'affectedArtifactTypes',
      finding_item->>'recommendation',
      observed_at
    );
  end loop;

  if target_source = 'agent' then
    insert into public.agent_run_events (
      run_id,
      event_type,
      payload
    )
    values (
      target_source_run_id,
      'consistency_findings_imported',
      jsonb_build_object(
        'scanId', new_scan_id,
        'findingCount', finding_count,
        'importedBy', auth.uid()
      )
    );

    update public.agent_run_reviews
    set
      application_summary = coalesce(application_summary, '{}'::jsonb)
        || jsonb_build_object(
          'consistencyScanId', new_scan_id,
          'consistencyFindingCount', finding_count,
          'consistencyImportedBy', auth.uid(),
          'consistencyImportedAt', observed_at
        ),
      updated_at = observed_at
    where run_id = target_source_run_id
      and project_id = target_project_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'scanId', new_scan_id,
    'existing', false,
    'findingCount', finding_count,
    'criticalCount', critical_count,
    'highCount', high_count,
    'mediumCount', medium_count,
    'lowCount', low_count,
    'infoCount', info_count
  );
end;
$$;

create or replace function public.review_consistency_finding(
  target_finding_id uuid,
  target_status text,
  target_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_finding public.consistency_findings%rowtype;
  target_organization_id uuid;
  previous_status text;
  changed_at timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if target_status not in ('open', 'accepted', 'dismissed', 'resolved') then
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_status',
      'error', 'El estado del hallazgo no es válido.'
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
  into selected_finding
  from public.consistency_findings
  where id = target_finding_id
  for update;

  if selected_finding.id is null then
    return jsonb_build_object(
      'ok', false,
      'code', 'finding_not_found',
      'error', 'El hallazgo no existe.'
    );
  end if;

  select organization_id
  into target_organization_id
  from public.projects
  where id = selected_finding.project_id;

  if not public.is_org_admin(target_organization_id) then
    return jsonb_build_object(
      'ok', false,
      'code', 'forbidden',
      'error', 'Solo un owner o admin puede administrar hallazgos.'
    );
  end if;

  previous_status := selected_finding.status;

  update public.consistency_findings
  set
    status = target_status,
    resolution_comment = nullif(target_comment, ''),
    reviewed_by = auth.uid(),
    reviewed_at = changed_at,
    resolved_by = case
      when target_status = 'resolved' then auth.uid()
      else null
    end,
    resolved_at = case
      when target_status = 'resolved' then changed_at
      else null
    end,
    updated_at = changed_at
  where id = target_finding_id;

  insert into public.consistency_finding_events (
    finding_id,
    project_id,
    event_type,
    status_from,
    status_to,
    comment,
    actor_id
  )
  values (
    target_finding_id,
    selected_finding.project_id,
    'status_changed',
    previous_status,
    target_status,
    nullif(target_comment, ''),
    auth.uid()
  );

  return jsonb_build_object(
    'ok', true,
    'findingId', target_finding_id,
    'previousStatus', previous_status,
    'status', target_status,
    'updatedAt', changed_at
  );
end;
$$;

revoke all
on function public.record_consistency_scan(
  uuid,
  text,
  uuid,
  uuid,
  integer,
  jsonb,
  jsonb
)
from public, anon;

grant execute
on function public.record_consistency_scan(
  uuid,
  text,
  uuid,
  uuid,
  integer,
  jsonb,
  jsonb
)
to authenticated;

revoke all
on function public.review_consistency_finding(
  uuid,
  text,
  text
)
from public, anon;

grant execute
on function public.review_consistency_finding(
  uuid,
  text,
  text
)
to authenticated;

commit;
