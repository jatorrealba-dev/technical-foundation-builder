begin;

create extension if not exists "pgcrypto";

alter table public.agent_runs
  drop constraint if exists agent_runs_agent_key_valid;

alter table public.agent_runs
  add constraint agent_runs_agent_key_valid
  check (
    agent_key in (
      'discovery',
      'interview',
      'project_model',
      'architecture',
      'security',
      'consistency',
      'readiness'
    )
  );

create or replace function public.reserve_agent_run(
  target_project_id uuid,
  target_agent_key text,
  target_provider text,
  target_model text,
  target_prompt_version text,
  target_input_snapshot jsonb,
  target_correlation_id uuid
)
returns table (
  run_id uuid,
  run_timeout_seconds integer,
  daily_runs_used integer,
  daily_runs_limit integer,
  monthly_tokens_used bigint,
  monthly_tokens_limit bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_organization_id uuid;
  actor_role text;
  policy public.organization_ai_policies%rowtype;
  current_daily_runs integer;
  current_monthly_tokens bigint;
  active_user_runs integer;
  active_project_agent_runs integer;
  created_run public.agent_runs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select projects.organization_id
  into target_organization_id
  from public.projects
  where projects.id = target_project_id;

  if target_organization_id is null then
    raise exception 'project_not_found';
  end if;

  select role
  into actor_role
  from public.organization_members
  where organization_id = target_organization_id
    and user_id = auth.uid();

  if actor_role is null then
    raise exception 'project_access_denied';
  end if;

  if target_agent_key is null or target_agent_key not in (
    'discovery',
    'interview',
    'project_model',
    'architecture',
    'security',
    'consistency',
    'readiness'
  ) then
    raise exception 'invalid_agent_key';
  end if;

  if target_provider is null or trim(target_provider) = ''
    or target_model is null or trim(target_model) = ''
    or target_prompt_version is null or trim(target_prompt_version) = ''
  then
    raise exception 'invalid_agent_runtime_metadata';
  end if;

  if target_agent_key = 'discovery'
    and target_prompt_version <> 'discovery.v2'
  then
    raise exception 'discovery_invalid_prompt_version';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      target_organization_id::text || ':' || auth.uid()::text,
      0
    )
  );

  insert into public.organization_ai_policies (organization_id)
  values (target_organization_id)
  on conflict (organization_id) do nothing;

  select *
  into policy
  from public.organization_ai_policies
  where organization_id = target_organization_id
  for update;

  if not policy.ai_enabled then
    raise exception 'organization_ai_disabled';
  end if;

  with recovered as (
    update public.agent_runs
    set
      status = 'failed',
      failure_code = 'stale_run_recovered',
      error_message = 'La ejecución excedió su ventana operativa y fue recuperada automáticamente.',
      completed_at = now(),
      updated_at = now()
    where organization_id = target_organization_id
      and status in ('queued', 'running')
      and coalesce(started_at, created_at) <
        now() - make_interval(
          secs => coalesce(timeout_seconds, policy.run_timeout_seconds) + 60
        )
    returning id, correlation_id
  )
  insert into public.agent_run_events (
    run_id,
    event_type,
    payload
  )
  select
    recovered.id,
    'run_recovered',
    jsonb_build_object(
      'failureCode', 'stale_run_recovered',
      'correlationId', recovered.correlation_id
    )
  from recovered;

  select count(*)::integer
  into current_daily_runs
  from public.agent_runs
  where organization_id = target_organization_id
    and created_by = auth.uid()
    and created_at >= date_trunc('day', now());

  if current_daily_runs >= policy.daily_run_limit_per_user then
    raise exception 'ai_daily_run_limit_exceeded';
  end if;

  select coalesce(sum(total_tokens), 0)::bigint
  into current_monthly_tokens
  from public.agent_runs
  where organization_id = target_organization_id
    and status = 'completed'
    and created_at >= date_trunc('month', now());

  if current_monthly_tokens >= policy.monthly_token_limit then
    raise exception 'ai_monthly_token_limit_exceeded';
  end if;

  select count(*)::integer
  into active_user_runs
  from public.agent_runs
  where organization_id = target_organization_id
    and created_by = auth.uid()
    and status in ('queued', 'running');

  if active_user_runs >= policy.max_concurrent_runs_per_user then
    raise exception 'ai_user_concurrency_limit_exceeded';
  end if;

  select count(*)::integer
  into active_project_agent_runs
  from public.agent_runs
  where project_id = target_project_id
    and agent_key = target_agent_key
    and status in ('queued', 'running');

  if active_project_agent_runs >= policy.max_concurrent_runs_per_project_agent then
    raise exception 'ai_project_agent_concurrency_limit_exceeded';
  end if;

  insert into public.agent_runs (
    organization_id,
    project_id,
    agent_key,
    status,
    provider,
    model,
    prompt_version,
    input_snapshot,
    created_by,
    correlation_id,
    timeout_seconds,
    policy_snapshot,
    started_at,
    updated_at
  )
  values (
    target_organization_id,
    target_project_id,
    target_agent_key,
    'running',
    target_provider,
    target_model,
    target_prompt_version,
    coalesce(target_input_snapshot, '{}'::jsonb),
    auth.uid(),
    coalesce(target_correlation_id, gen_random_uuid()),
    policy.run_timeout_seconds,
    jsonb_build_object(
      'aiEnabled', policy.ai_enabled,
      'dailyRunLimitPerUser', policy.daily_run_limit_per_user,
      'monthlyTokenLimit', policy.monthly_token_limit,
      'maxConcurrentRunsPerUser', policy.max_concurrent_runs_per_user,
      'maxConcurrentRunsPerProjectAgent', policy.max_concurrent_runs_per_project_agent,
      'runTimeoutSeconds', policy.run_timeout_seconds
    ),
    now(),
    now()
  )
  returning * into created_run;

  insert into public.agent_run_events (
    run_id,
    event_type,
    payload
  )
  values (
    created_run.id,
    'run_started',
    jsonb_build_object(
      'agentKey', target_agent_key,
      'model', target_model,
      'promptVersion', target_prompt_version,
      'correlationId', created_run.correlation_id,
      'timeoutSeconds', policy.run_timeout_seconds
    )
  );

  return query
  select
    created_run.id,
    policy.run_timeout_seconds,
    current_daily_runs + 1,
    policy.daily_run_limit_per_user,
    current_monthly_tokens,
    policy.monthly_token_limit;
end;
$$;

create table public.discovery_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique
    references public.projects(id)
    on delete cascade,
  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,
  status text not null default 'not_started'
    check (
      status in (
        'not_started',
        'in_progress',
        'ready_for_review',
        'completed',
        'completed_with_open_items',
        'abandoned'
      )
    ),
  summary text not null default '',
  turn_count integer not null default 0 check (turn_count >= 0),
  soft_turn_limit integer not null default 30
    check (soft_turn_limit between 5 and 100),
  hard_turn_limit integer not null default 60
    check (hard_turn_limit between 10 and 200),
  current_coverage_score numeric(5, 2) not null default 0
    check (current_coverage_score between 0 and 100),
  active_turn_id uuid,
  active_turn_started_at timestamptz,
  active_turn_user_message_id uuid,
  last_agent_run_id uuid
    references public.agent_runs(id)
    on delete set null,
  lock_version integer not null default 0 check (lock_version >= 0),
  started_by uuid references auth.users(id) on delete set null,
  started_at timestamptz,
  ready_for_review_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  completion_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (soft_turn_limit < hard_turn_limit),
  check (
    (active_turn_id is null
      and active_turn_started_at is null
      and active_turn_user_message_id is null)
    or
    (active_turn_id is not null
      and active_turn_started_at is not null
      and active_turn_user_message_id is not null)
  )
);

create table public.discovery_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null
    references public.discovery_sessions(id)
    on delete cascade,
  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,
  project_id uuid not null
    references public.projects(id)
    on delete cascade,
  turn_id uuid not null,
  role text not null check (role in ('system', 'assistant', 'user')),
  content text not null check (char_length(trim(content)) between 1 and 20000),
  sequence_number integer not null check (sequence_number > 0),
  client_message_id uuid,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  correlation_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (role = 'user' and client_message_id is not null)
    or (role <> 'user' and client_message_id is null)
  ),
  check (
    (role = 'assistant' and agent_run_id is not null)
    or role <> 'assistant'
  ),
  unique (session_id, sequence_number),
  unique (session_id, client_message_id)
);

create unique index idx_discovery_messages_agent_run
on public.discovery_messages(agent_run_id)
where agent_run_id is not null;

create index idx_discovery_messages_session_created
on public.discovery_messages(session_id, sequence_number);

create index idx_discovery_messages_turn
on public.discovery_messages(session_id, turn_id);


create table public.discovery_knowledge (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null
    references public.discovery_sessions(id)
    on delete cascade,
  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,
  project_id uuid not null
    references public.projects(id)
    on delete cascade,
  external_key text not null check (char_length(trim(external_key)) between 1 and 120),
  knowledge_type text not null
    check (
      knowledge_type in (
        'fact',
        'decision',
        'requirement',
        'constraint',
        'preference',
        'assumption',
        'risk',
        'open_question',
        'out_of_scope',
        'future_scope'
      )
    ),
  dimension text not null
    check (
      dimension in (
        'problem', 'goals', 'users', 'roles', 'workflow', 'domain',
        'data', 'integrations', 'security', 'operations', 'constraints',
        'success_metrics', 'delivery'
      )
    ),
  statement text not null check (char_length(trim(statement)) between 1 and 1200),
  normalized_statement text not null,
  validation_status text not null default 'proposed'
    check (validation_status in ('proposed', 'confirmed', 'rejected', 'superseded')),
  confidence numeric(4, 3) not null check (confidence between 0 and 1),
  source_message_ids uuid[] not null check (cardinality(source_message_ids) between 1 and 12),
  agent_run_id uuid not null references public.agent_runs(id) on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  superseded_by uuid references public.discovery_knowledge(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, external_key)
);

create index idx_discovery_knowledge_session_status
on public.discovery_knowledge(session_id, validation_status, dimension);

create table public.discovery_gaps (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null
    references public.discovery_sessions(id)
    on delete cascade,
  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,
  project_id uuid not null
    references public.projects(id)
    on delete cascade,
  external_key text not null check (char_length(trim(external_key)) between 1 and 120),
  dimension text not null
    check (
      dimension in (
        'problem', 'goals', 'users', 'roles', 'workflow', 'domain',
        'data', 'integrations', 'security', 'operations', 'constraints',
        'success_metrics', 'delivery'
      )
    ),
  description text not null check (char_length(trim(description)) between 1 and 1200),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open'
    check (status in ('open', 'resolved', 'deferred', 'accepted_open', 'superseded')),
  affected_artifacts text[] not null
    check (
      cardinality(affected_artifacts) between 1 and 8
      and affected_artifacts <@ array[
        'product_spec', 'mvp_scope', 'domain_model', 'architecture',
        'data_model', 'security', 'backlog', 'vertical_slice_plan'
      ]::text[]
    ),
  source_message_ids uuid[] not null default '{}'
    check (cardinality(source_message_ids) between 0 and 12),
  resolution_note text,
  accepted_consequence text,
  created_by_agent_run_id uuid not null
    references public.agent_runs(id)
    on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, external_key)
);

create index idx_discovery_gaps_session_status
on public.discovery_gaps(session_id, status, severity);

create table public.discovery_contradictions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null
    references public.discovery_sessions(id)
    on delete cascade,
  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,
  project_id uuid not null
    references public.projects(id)
    on delete cascade,
  external_key text not null check (char_length(trim(external_key)) between 1 and 120),
  dimension text not null
    check (
      dimension in (
        'problem', 'goals', 'users', 'roles', 'workflow', 'domain',
        'data', 'integrations', 'security', 'operations', 'constraints',
        'success_metrics', 'delivery'
      )
    ),
  statement_a text not null check (char_length(trim(statement_a)) between 1 and 1200),
  statement_b text not null check (char_length(trim(statement_b)) between 1 and 1200),
  source_message_a_id uuid not null
    references public.discovery_messages(id)
    on delete restrict,
  source_message_b_id uuid not null
    references public.discovery_messages(id)
    on delete restrict,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  resolution_question text not null
    check (char_length(trim(resolution_question)) between 1 and 1200),
  affected_artifacts text[] not null
    check (
      cardinality(affected_artifacts) between 1 and 8
      and affected_artifacts <@ array[
        'product_spec', 'mvp_scope', 'domain_model', 'architecture',
        'data_model', 'security', 'backlog', 'vertical_slice_plan'
      ]::text[]
    ),
  status text not null default 'open'
    check (status in ('open', 'resolved', 'dismissed', 'superseded')),
  resolution_note text,
  created_by_agent_run_id uuid not null
    references public.agent_runs(id)
    on delete restrict,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, external_key)
);

create index idx_discovery_contradictions_session_status
on public.discovery_contradictions(session_id, status, severity);

create table public.discovery_coverage (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null
    references public.discovery_sessions(id)
    on delete cascade,
  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,
  project_id uuid not null
    references public.projects(id)
    on delete cascade,
  dimension text not null
    check (
      dimension in (
        'problem', 'goals', 'users', 'roles', 'workflow', 'domain',
        'data', 'integrations', 'security', 'operations', 'constraints',
        'success_metrics', 'delivery'
      )
    ),
  status text not null default 'missing'
    check (status in ('missing', 'partial', 'complete', 'not_applicable')),
  satisfied_criteria jsonb not null default '[]'::jsonb
    check (jsonb_typeof(satisfied_criteria) = 'array'),
  missing_criteria jsonb not null default '[]'::jsonb
    check (jsonb_typeof(missing_criteria) = 'array'),
  not_applicable_criteria jsonb not null default '[]'::jsonb
    check (jsonb_typeof(not_applicable_criteria) = 'array'),
  evidence jsonb not null default '[]'::jsonb
    check (jsonb_typeof(evidence) = 'array'),
  rationale text not null default '',
  confidence numeric(4, 3) not null default 0 check (confidence between 0 and 1),
  evaluated_by_agent_run_id uuid references public.agent_runs(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (session_id, dimension)
);

create table public.discovery_artifact_readiness (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null
    references public.discovery_sessions(id)
    on delete cascade,
  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,
  project_id uuid not null
    references public.projects(id)
    on delete cascade,
  artifact_type text not null
    check (
      artifact_type in (
        'product_spec', 'mvp_scope', 'domain_model', 'architecture',
        'data_model', 'security', 'backlog', 'vertical_slice_plan'
      )
    ),
  status text not null default 'blocked'
    check (status in ('blocked', 'insufficient', 'usable', 'ready')),
  agent_status text
    check (agent_status is null or agent_status in ('blocked', 'insufficient', 'usable', 'ready')),
  blockers jsonb not null default '[]'::jsonb
    check (jsonb_typeof(blockers) = 'array'),
  rationale text not null default '',
  evaluated_by_agent_run_id uuid references public.agent_runs(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (session_id, artifact_type)
);

create table public.discovery_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null
    references public.discovery_sessions(id)
    on delete cascade,
  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,
  project_id uuid not null
    references public.projects(id)
    on delete cascade,
  event_type text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  agent_run_id uuid references public.agent_runs(id) on delete set null,
  correlation_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_discovery_events_session_created
on public.discovery_events(session_id, created_at desc);

create or replace function public.discovery_v2_dimensions()
returns text[]
language sql
immutable
as $$
  select array[
    'problem', 'goals', 'users', 'roles', 'workflow', 'domain',
    'data', 'integrations', 'security', 'operations', 'constraints',
    'success_metrics', 'delivery'
  ]::text[];
$$;

create or replace function public.discovery_v2_artifacts()
returns text[]
language sql
immutable
as $$
  select array[
    'product_spec', 'mvp_scope', 'domain_model', 'architecture',
    'data_model', 'security', 'backlog', 'vertical_slice_plan'
  ]::text[];
$$;

create or replace function public.discovery_v2_criteria(target_dimension text)
returns text[]
language sql
immutable
strict
as $$
  select case target_dimension
    when 'problem' then array[
      'current_state','affected_party','consequence','frequency_context','motivation','workaround'
    ]::text[]
    when 'goals' then array[
      'business_outcome','user_outcome','mvp_objective','priorities','secondary_goals','exclusions','time_horizon'
    ]::text[]
    when 'users' then array[
      'user_types','responsibilities','user_goals','usage_context','technical_level','channel_device','usage_frequency','limitations'
    ]::text[]
    when 'roles' then array[
      'role_catalog','allowed_actions','prohibited_actions','organizational_scope','separation_of_duties','approvals','exceptions','role_administration','deactivation_behavior'
    ]::text[]
    when 'workflow' then array[
      'trigger','initiator','happy_path','states','transitions','stage_ownership','validations','cancellation','failure','retry','rollback','terminal_state','exceptions'
    ]::text[]
    when 'domain' then array[
      'entities','entity_purpose','identity','relationships','business_rules','invariants','lifecycle','initial_state','terminal_states','domain_events'
    ]::text[]
    when 'data' then array[
      'core_data','sources','ownership','sensitivity','relationships','retention','deletion','auditability','volume','consistency','import_export','derived_data','regulatory'
    ]::text[]
    when 'integrations' then array[
      'systems','purpose','direction','exchanged_data','authentication','protocol','timeout','retry','idempotency','duplicate_handling','reconciliation','degradation','outage_behavior'
    ]::text[]
    when 'security' then array[
      'authentication','authorization','tenant_isolation','sensitive_data','secrets','account_recovery','auditability','privacy','threats','regulatory','access_revocation','sessions','critical_operations','admin_controls'
    ]::text[]
    when 'operations' then array[
      'environments','deployment','observability','logs','metrics','alerts','backups','restore','disaster_recovery','incidents','support','operational_owner','maintenance','external_dependencies','degraded_offline'
    ]::text[]
    when 'constraints' then array[
      'time','budget','mandatory_technology','prohibited_technology','team','regulatory','compatibility','devices','data_residency','organizational_dependencies','performance','contractual'
    ]::text[]
    when 'success_metrics' then array[
      'measurable_outcome','metric','baseline','target','measurement_period','data_source','owner','acceptance_criteria','failure_signals'
    ]::text[]
    when 'delivery' then array[
      'mvp_scope','out_of_scope','dependencies','priority','implementation_order','vertical_slice','acceptance_criteria','test_strategy','timeline','delivery_risks','launch_conditions'
    ]::text[]
    else null
  end;
$$;

create or replace function public.discovery_v2_not_applicable_dimensions()
returns text[]
language sql
immutable
as $$
  select array['roles', 'integrations']::text[];
$$;

create or replace function public.discovery_v2_normalize_statement(target_statement text)
returns text
language sql
immutable
strict
as $$
  select trim(regexp_replace(lower(target_statement), '\s+', ' ', 'g'));
$$;

create or replace function public.discovery_v2_normalize_knowledge_status(
  target_statement text,
  requested_status text
)
returns text
language plpgsql
immutable
as $$
begin
  if requested_status = 'confirmed'
    and lower(coalesce(target_statement, '')) ~
      '(quiz[aá]s|tal vez|probablemente|posiblemente|puede que|creo que|no estoy seguro|se ver[aá] despu[eé]s|podr[ií]a)'
  then
    return 'proposed';
  end if;

  return requested_status;
end;
$$;

create or replace function public.discovery_v2_append_event(
  target_session_id uuid,
  target_event_type text,
  target_actor_user_id uuid default null,
  target_agent_run_id uuid default null,
  target_correlation_id uuid default null,
  target_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session public.discovery_sessions%rowtype;
begin
  select *
  into target_session
  from public.discovery_sessions
  where id = target_session_id;

  if target_session.id is null then
    raise exception 'discovery_session_not_found';
  end if;

  insert into public.discovery_events (
    session_id,
    organization_id,
    project_id,
    event_type,
    actor_user_id,
    agent_run_id,
    correlation_id,
    payload
  )
  values (
    target_session.id,
    target_session.organization_id,
    target_session.project_id,
    target_event_type,
    target_actor_user_id,
    target_agent_run_id,
    target_correlation_id,
    coalesce(target_payload, '{}'::jsonb)
  );
end;
$$;

create or replace function public.refresh_discovery_artifact_readiness(
  target_session_id uuid,
  target_agent_run_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session public.discovery_sessions%rowtype;
  artifact_record record;
  missing_count integer;
  partial_count integer;
  critical_count integer;
  high_count integer;
  next_status text;
  next_blockers jsonb;
begin
  select *
  into target_session
  from public.discovery_sessions
  where id = target_session_id;

  if target_session.id is null then
    raise exception 'discovery_session_not_found';
  end if;

  for artifact_record in
    select *
    from (
      values
        ('product_spec', array['problem','goals','users','workflow','constraints','success_metrics']::text[]),
        ('mvp_scope', array['goals','workflow','constraints','success_metrics','delivery']::text[]),
        ('domain_model', array['users','roles','workflow','domain']::text[]),
        ('architecture', array['workflow','domain','data','integrations','security','operations','constraints','delivery']::text[]),
        ('data_model', array['domain','data','security','constraints']::text[]),
        ('security', array['users','roles','data','integrations','security','operations']::text[]),
        ('backlog', array['goals','users','workflow','constraints','success_metrics','delivery']::text[]),
        ('vertical_slice_plan', array['workflow','domain','data','integrations','security','delivery']::text[])
    ) as requirements(artifact_type, required_dimensions)
  loop
    select count(*)::integer
    into missing_count
    from public.discovery_coverage
    where session_id = target_session_id
      and dimension = any(artifact_record.required_dimensions)
      and status = 'missing';

    select count(*)::integer
    into partial_count
    from public.discovery_coverage
    where session_id = target_session_id
      and dimension = any(artifact_record.required_dimensions)
      and status = 'partial';

    select count(*)::integer
    into critical_count
    from (
      select severity, affected_artifacts
      from public.discovery_gaps
      where session_id = target_session_id and status = 'open'
      union all
      select severity, affected_artifacts
      from public.discovery_contradictions
      where session_id = target_session_id and status = 'open'
    ) as issues
    where issues.severity = 'critical'
      and artifact_record.artifact_type = any(issues.affected_artifacts);

    select count(*)::integer
    into high_count
    from (
      select severity, affected_artifacts
      from public.discovery_gaps
      where session_id = target_session_id and status = 'open'
      union all
      select severity, affected_artifacts
      from public.discovery_contradictions
      where session_id = target_session_id and status = 'open'
    ) as issues
    where issues.severity = 'high'
      and artifact_record.artifact_type = any(issues.affected_artifacts);

    select coalesce(jsonb_agg(blocker order by blocker), '[]'::jsonb)
    into next_blockers
    from (
      select 'Cobertura faltante: ' || dimension as blocker
      from public.discovery_coverage
      where session_id = target_session_id
        and dimension = any(artifact_record.required_dimensions)
        and status = 'missing'
      union
      select description
      from public.discovery_gaps
      where session_id = target_session_id
        and status = 'open'
        and severity in ('high', 'critical')
        and artifact_record.artifact_type = any(affected_artifacts)
      union
      select resolution_question
      from public.discovery_contradictions
      where session_id = target_session_id
        and status = 'open'
        and severity in ('high', 'critical')
        and artifact_record.artifact_type = any(affected_artifacts)
    ) as blocker_rows;

    if missing_count > 0 or critical_count > 0 then
      next_status := 'blocked';
    elsif partial_count > 0 or high_count > 0 then
      next_status := 'usable';
    else
      next_status := 'ready';
    end if;

    insert into public.discovery_artifact_readiness (
      session_id,
      organization_id,
      project_id,
      artifact_type,
      status,
      blockers,
      rationale,
      evaluated_by_agent_run_id,
      updated_at
    )
    values (
      target_session.id,
      target_session.organization_id,
      target_session.project_id,
      artifact_record.artifact_type,
      next_status,
      next_blockers,
      case next_status
        when 'blocked' then 'Existen bloqueadores críticos o cobertura faltante.'
        when 'insufficient' then 'La evidencia todavía es insuficiente para uso técnico.'
        when 'usable' then 'Existe evidencia utilizable, aunque todavía no está completamente cerrada.'
        else 'Todas las dimensiones requeridas están completas o justificadas como no aplicables.'
      end,
      target_agent_run_id,
      now()
    )
    on conflict (session_id, artifact_type) do update
    set
      status = excluded.status,
      blockers = excluded.blockers,
      rationale = excluded.rationale,
      evaluated_by_agent_run_id = excluded.evaluated_by_agent_run_id,
      updated_at = now();
  end loop;
end;
$$;

create or replace function public.ensure_discovery_session(
  target_project_id uuid
)
returns public.discovery_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  target_organization_id uuid;
  target_session public.discovery_sessions%rowtype;
  created_session boolean := false;
  dimension_name text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select organization_id
  into target_organization_id
  from public.projects
  where id = target_project_id;

  if target_organization_id is null then
    raise exception 'project_not_found';
  end if;

  if not public.is_org_member(target_organization_id) then
    raise exception 'project_access_denied';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('discovery-session:' || target_project_id::text, 0)
  );

  select *
  into target_session
  from public.discovery_sessions
  where project_id = target_project_id;

  if target_session.id is null then
    insert into public.discovery_sessions (
      project_id,
      organization_id,
      started_by
    )
    values (
      target_project_id,
      target_organization_id,
      auth.uid()
    )
    returning * into target_session;

    created_session := true;

    foreach dimension_name in array public.discovery_v2_dimensions()
    loop
      insert into public.discovery_coverage (
        session_id,
        organization_id,
        project_id,
        dimension,
        status
      )
      values (
        target_session.id,
        target_session.organization_id,
        target_session.project_id,
        dimension_name,
        'missing'
      );
    end loop;

    perform public.refresh_discovery_artifact_readiness(target_session.id, null);

    perform public.discovery_v2_append_event(
      target_session.id,
      'session.created',
      auth.uid(),
      null,
      null,
      jsonb_build_object('promptVersion', 'discovery.v2')
    );
  end if;

  if created_session then
    select *
    into target_session
    from public.discovery_sessions
    where id = target_session.id;
  end if;

  return target_session;
end;
$$;

create or replace function public.start_discovery_turn(
  target_project_id uuid,
  target_content text,
  target_client_message_id uuid
)
returns table (
  session_id uuid,
  turn_id uuid,
  user_message_id uuid,
  sequence_number integer,
  turn_count integer,
  turn_mode text,
  should_process boolean,
  idempotent boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session public.discovery_sessions%rowtype;
  existing_message public.discovery_messages%rowtype;
  assistant_exists boolean;
  next_turn_id uuid;
  next_sequence integer;
  next_turn_count integer;
  next_turn_mode text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if target_client_message_id is null then
    raise exception 'discovery_client_message_id_required';
  end if;

  if target_content is null or char_length(trim(target_content)) not between 1 and 20000 then
    raise exception 'discovery_invalid_message';
  end if;

  select *
  into target_session
  from public.ensure_discovery_session(target_project_id);

  select *
  into target_session
  from public.discovery_sessions
  where id = target_session.id
  for update;

  select *
  into existing_message
  from public.discovery_messages
  where session_id = target_session.id
    and client_message_id = target_client_message_id;

  if existing_message.id is not null then
    if existing_message.content <> trim(target_content) then
      raise exception 'discovery_duplicate_message_mismatch';
    end if;

    select exists (
      select 1
      from public.discovery_messages
      where session_id = target_session.id
        and turn_id = existing_message.turn_id
        and role = 'assistant'
    ) into assistant_exists;

    if assistant_exists or target_session.active_turn_id = existing_message.turn_id then
      return query
      select
        target_session.id,
        existing_message.turn_id,
        existing_message.id,
        existing_message.sequence_number,
        target_session.turn_count,
        case
          when target_session.turn_count >= target_session.hard_turn_limit then 'human_review_required'
          when target_session.turn_count >= target_session.soft_turn_limit then 'blockers_only'
          else 'normal'
        end,
        false,
        true;
      return;
    end if;

    if target_session.active_turn_id is not null then
      raise exception 'discovery_turn_in_progress';
    end if;

    if target_session.turn_count >= target_session.hard_turn_limit then
      return query
      select
        target_session.id,
        existing_message.turn_id,
        existing_message.id,
        existing_message.sequence_number,
        target_session.turn_count,
        'human_review_required',
        false,
        true;
      return;
    end if;

    update public.discovery_sessions
    set
      status = 'in_progress',
      active_turn_id = existing_message.turn_id,
      active_turn_started_at = now(),
      active_turn_user_message_id = existing_message.id,
      lock_version = lock_version + 1,
      started_at = coalesce(started_at, now()),
      started_by = coalesce(started_by, auth.uid()),
      updated_at = now()
    where id = target_session.id
    returning * into target_session;

    perform public.discovery_v2_append_event(
      target_session.id,
      'turn.retried',
      auth.uid(),
      null,
      null,
      jsonb_build_object(
        'turnId', existing_message.turn_id,
        'userMessageId', existing_message.id
      )
    );

    return query
    select
      target_session.id,
      existing_message.turn_id,
      existing_message.id,
      existing_message.sequence_number,
      target_session.turn_count,
      case
        when target_session.turn_count >= target_session.hard_turn_limit then 'human_review_required'
        when target_session.turn_count >= target_session.soft_turn_limit then 'blockers_only'
        else 'normal'
      end,
      true,
      true;
    return;
  end if;

  if target_session.status in ('completed', 'completed_with_open_items', 'abandoned') then
    raise exception 'discovery_session_completed';
  end if;

  if target_session.active_turn_id is not null then
    if target_session.active_turn_started_at < now() - interval '15 minutes' then
      perform public.discovery_v2_append_event(
        target_session.id,
        'turn.recovered',
        auth.uid(),
        null,
        null,
        jsonb_build_object(
          'turnId', target_session.active_turn_id,
          'reason', 'stale_turn_recovered'
        )
      );

      update public.discovery_sessions
      set
        active_turn_id = null,
        active_turn_started_at = null,
        active_turn_user_message_id = null,
        lock_version = lock_version + 1,
        updated_at = now()
      where id = target_session.id
      returning * into target_session;
    else
      raise exception 'discovery_turn_in_progress';
    end if;
  end if;

  if target_session.turn_count >= target_session.hard_turn_limit then
    raise exception 'discovery_hard_turn_limit_reached';
  end if;

  next_turn_id := gen_random_uuid();
  next_turn_count := target_session.turn_count + 1;

  select coalesce(max(messages.sequence_number), 0) + 1
  into next_sequence
  from public.discovery_messages as messages
  where messages.session_id = target_session.id;

  insert into public.discovery_messages (
    session_id,
    organization_id,
    project_id,
    turn_id,
    role,
    content,
    sequence_number,
    client_message_id,
    created_by
  )
  values (
    target_session.id,
    target_session.organization_id,
    target_session.project_id,
    next_turn_id,
    'user',
    trim(target_content),
    next_sequence,
    target_client_message_id,
    auth.uid()
  )
  returning id into user_message_id;

  next_turn_mode := case
    when next_turn_count >= target_session.hard_turn_limit then 'human_review_required'
    when next_turn_count >= target_session.soft_turn_limit then 'blockers_only'
    else 'normal'
  end;

  update public.discovery_sessions
  set
    status = 'in_progress',
    turn_count = next_turn_count,
    active_turn_id = case
      when next_turn_mode = 'human_review_required' then null
      else next_turn_id
    end,
    active_turn_started_at = case
      when next_turn_mode = 'human_review_required' then null
      else now()
    end,
    active_turn_user_message_id = case
      when next_turn_mode = 'human_review_required' then null
      else user_message_id
    end,
    lock_version = lock_version + 1,
    started_at = coalesce(started_at, now()),
    started_by = coalesce(started_by, auth.uid()),
    updated_at = now()
  where id = target_session.id
  returning * into target_session;

  perform public.discovery_v2_append_event(
    target_session.id,
    'turn.started',
    auth.uid(),
    null,
    null,
    jsonb_build_object(
      'turnId', next_turn_id,
      'userMessageId', user_message_id,
      'turnCount', next_turn_count,
      'turnMode', next_turn_mode
    )
  );

  perform public.discovery_v2_append_event(
    target_session.id,
    'message.user_recorded',
    auth.uid(),
    null,
    null,
    jsonb_build_object(
      'turnId', next_turn_id,
      'messageId', user_message_id,
      'sequenceNumber', next_sequence
    )
  );

  if next_turn_mode = 'human_review_required' then
    perform public.discovery_v2_append_event(
      target_session.id,
      'turn.human_review_required',
      auth.uid(),
      null,
      null,
      jsonb_build_object(
        'turnId', next_turn_id,
        'userMessageId', user_message_id,
        'turnCount', next_turn_count
      )
    );
  end if;

  return query
  select
    target_session.id,
    next_turn_id,
    user_message_id,
    next_sequence,
    next_turn_count,
    next_turn_mode,
    next_turn_mode <> 'human_review_required',
    false;
end;
$$;

create or replace function public.record_discovery_agent_output(
  target_session_id uuid,
  target_turn_id uuid,
  target_agent_run_id uuid,
  target_output jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session public.discovery_sessions%rowtype;
  target_run public.agent_runs%rowtype;
  output_item jsonb;
  evidence_item jsonb;
  source_ids uuid[];
  next_sequence integer;
  assistant_message_id uuid;
  output_dimension_count integer;
  output_artifact_count integer;
  coverage_score numeric(5, 2);
  normalized_status text;
  contradiction_source_a uuid;
  contradiction_source_b uuid;
  required_criteria text[];
  satisfied_criteria text[];
  missing_criteria text[];
  not_applicable_criteria text[];
  referenced_criteria text[];
  evidence_criteria text[];
  evidence_source_ids uuid[];
  criterion_name text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select *
  into target_session
  from public.discovery_sessions
  where id = target_session_id
  for update;

  if target_session.id is null then
    raise exception 'discovery_session_not_found';
  end if;

  if not public.is_org_member(target_session.organization_id) then
    raise exception 'project_access_denied';
  end if;

  if target_session.active_turn_id is distinct from target_turn_id then
    raise exception 'discovery_stale_turn';
  end if;

  if not public.is_org_admin(target_session.organization_id)
    and not exists (
      select 1
      from public.discovery_messages
      where id = target_session.active_turn_user_message_id
        and session_id = target_session.id
        and created_by = auth.uid()
    )
  then
    raise exception 'discovery_turn_owner_mismatch';
  end if;

  select *
  into target_run
  from public.agent_runs
  where id = target_agent_run_id;

  if target_run.id is null
    or target_run.organization_id <> target_session.organization_id
    or target_run.project_id <> target_session.project_id
    or target_run.agent_key <> 'discovery'
    or target_run.prompt_version <> 'discovery.v2'
    or target_run.status <> 'completed'
  then
    raise exception 'discovery_agent_run_mismatch';
  end if;

  if target_run.created_by <> auth.uid()
    and not public.is_org_admin(target_session.organization_id)
  then
    raise exception 'discovery_agent_run_owner_mismatch';
  end if;

  if target_run.input_snapshot->>'discoverySessionId' is distinct from target_session.id::text
    or target_run.input_snapshot->>'turnId' is distinct from target_turn_id::text
    or target_run.input_snapshot->>'userMessageId' is distinct from target_session.active_turn_user_message_id::text
  then
    raise exception 'discovery_agent_run_turn_mismatch';
  end if;

  if exists (
    select 1
    from public.discovery_messages
    where agent_run_id = target_agent_run_id
  ) then
    raise exception 'discovery_agent_output_already_recorded';
  end if;

  if target_output is null
    or jsonb_typeof(target_output) <> 'object'
    or target_output->>'promptVersion' <> 'discovery.v2'
    or nullif(trim(target_output->>'assistantMessage'), '') is null
    or char_length(trim(target_output->>'assistantMessage')) > 4000
    or nullif(trim(target_output->>'understandingSummary'), '') is null
    or char_length(trim(target_output->>'understandingSummary')) > 6000
    or jsonb_typeof(target_output->'completionAssessment') <> 'object'
    or (
      target_output->'nextQuestion' is not null
      and target_output->'nextQuestion' <> 'null'::jsonb
      and jsonb_typeof(target_output->'nextQuestion') <> 'object'
    )
  then
    raise exception 'discovery_invalid_agent_output';
  end if;

  if jsonb_typeof(target_output->'coverage') <> 'array'
    or jsonb_array_length(target_output->'coverage') <> 13
  then
    raise exception 'discovery_invalid_coverage_output';
  end if;

  select count(distinct value->>'dimension')::integer
  into output_dimension_count
  from jsonb_array_elements(target_output->'coverage');

  if output_dimension_count <> 13
    or exists (
      select 1
      from jsonb_array_elements(target_output->'coverage') as coverage_item(value)
      where value->>'dimension' <> all(public.discovery_v2_dimensions())
    )
  then
    raise exception 'discovery_invalid_coverage_output';
  end if;

  if jsonb_typeof(target_output->'artifactReadiness') <> 'array'
    or jsonb_array_length(target_output->'artifactReadiness') <> 8
  then
    raise exception 'discovery_invalid_artifact_readiness_output';
  end if;

  select count(distinct value->>'artifact')::integer
  into output_artifact_count
  from jsonb_array_elements(target_output->'artifactReadiness');

  if output_artifact_count <> 8
    or exists (
      select 1
      from jsonb_array_elements(target_output->'artifactReadiness') as readiness_item(value)
      where value->>'artifact' <> all(public.discovery_v2_artifacts())
    )
  then
    raise exception 'discovery_invalid_artifact_readiness_output';
  end if;

  select coalesce(max(messages.sequence_number), 0) + 1
  into next_sequence
  from public.discovery_messages as messages
  where messages.session_id = target_session.id;

  insert into public.discovery_messages (
    session_id,
    organization_id,
    project_id,
    turn_id,
    role,
    content,
    sequence_number,
    agent_run_id,
    correlation_id,
    created_by
  )
  values (
    target_session.id,
    target_session.organization_id,
    target_session.project_id,
    target_turn_id,
    'assistant',
    trim(target_output->>'assistantMessage'),
    next_sequence,
    target_run.id,
    target_run.correlation_id,
    target_run.created_by
  )
  returning id into assistant_message_id;

  if jsonb_typeof(coalesce(target_output->'extractedKnowledge', '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(target_output->'extractedKnowledge', '[]'::jsonb)) > 20
    or jsonb_typeof(coalesce(target_output->'gaps', '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(target_output->'gaps', '[]'::jsonb)) > 20
    or jsonb_typeof(coalesce(target_output->'contradictions', '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(target_output->'contradictions', '[]'::jsonb)) > 12
  then
    raise exception 'discovery_invalid_agent_output_collections';
  end if;

  for output_item in
    select value
    from jsonb_array_elements(coalesce(target_output->'extractedKnowledge', '[]'::jsonb))
  loop
    source_ids := array(
      select source_id::uuid
      from jsonb_array_elements_text(output_item->'sourceMessageIds') as source_values(source_id)
    );

    if source_ids is null or cardinality(source_ids) = 0 then
      raise exception 'discovery_knowledge_source_required';
    end if;

    if (
      select count(distinct id)
      from public.discovery_messages
      where session_id = target_session.id
        and id = any(source_ids)
        and role = 'user'
    ) <> cardinality(source_ids) then
      raise exception 'discovery_invalid_source_message';
    end if;

    normalized_status := public.discovery_v2_normalize_knowledge_status(
      output_item->>'statement',
      output_item->>'validationStatus'
    );

    insert into public.discovery_knowledge (
      session_id,
      organization_id,
      project_id,
      external_key,
      knowledge_type,
      dimension,
      statement,
      normalized_statement,
      validation_status,
      confidence,
      source_message_ids,
      agent_run_id,
      updated_at
    )
    values (
      target_session.id,
      target_session.organization_id,
      target_session.project_id,
      output_item->>'id',
      output_item->>'type',
      output_item->>'dimension',
      trim(output_item->>'statement'),
      public.discovery_v2_normalize_statement(output_item->>'statement'),
      normalized_status,
      (output_item->>'confidence')::numeric,
      source_ids,
      target_run.id,
      now()
    )
    on conflict (session_id, external_key) do update
    set
      knowledge_type = excluded.knowledge_type,
      dimension = excluded.dimension,
      statement = excluded.statement,
      normalized_statement = excluded.normalized_statement,
      validation_status = case
        when public.discovery_knowledge.reviewed_at is not null
          then public.discovery_knowledge.validation_status
        else excluded.validation_status
      end,
      confidence = excluded.confidence,
      source_message_ids = excluded.source_message_ids,
      agent_run_id = excluded.agent_run_id,
      updated_at = now()
    where public.discovery_knowledge.reviewed_at is null;
  end loop;

  for output_item in
    select value
    from jsonb_array_elements(coalesce(target_output->'gaps', '[]'::jsonb))
  loop
    source_ids := array(
      select source_id::uuid
      from jsonb_array_elements_text(coalesce(output_item->'evidenceMessageIds', '[]'::jsonb))
        as source_values(source_id)
    );

    if cardinality(source_ids) > 0 and (
      select count(distinct id)
      from public.discovery_messages
      where session_id = target_session.id
        and id = any(source_ids)
        and role = 'user'
    ) <> cardinality(source_ids) then
      raise exception 'discovery_invalid_source_message';
    end if;

    insert into public.discovery_gaps (
      session_id,
      organization_id,
      project_id,
      external_key,
      dimension,
      description,
      severity,
      status,
      affected_artifacts,
      source_message_ids,
      created_by_agent_run_id,
      updated_at
    )
    values (
      target_session.id,
      target_session.organization_id,
      target_session.project_id,
      output_item->>'id',
      output_item->>'dimension',
      trim(output_item->>'description'),
      output_item->>'severity',
      'open',
      array(
        select artifact_name
        from jsonb_array_elements_text(output_item->'affectedArtifacts')
          as artifact_values(artifact_name)
      ),
      coalesce(source_ids, '{}'::uuid[]),
      target_run.id,
      now()
    )
    on conflict (session_id, external_key) do update
    set
      dimension = excluded.dimension,
      description = excluded.description,
      severity = excluded.severity,
      status = case
        when public.discovery_gaps.status = 'accepted_open' then 'accepted_open'
        else 'open'
      end,
      affected_artifacts = excluded.affected_artifacts,
      source_message_ids = excluded.source_message_ids,
      created_by_agent_run_id = excluded.created_by_agent_run_id,
      reviewed_by = case
        when public.discovery_gaps.status = 'accepted_open' then public.discovery_gaps.reviewed_by
        else null
      end,
      reviewed_at = null,
      updated_at = now()
    where public.discovery_gaps.status <> 'accepted_open';
  end loop;

  for output_item in
    select value
    from jsonb_array_elements(coalesce(target_output->'contradictions', '[]'::jsonb))
  loop
    contradiction_source_a := (output_item->>'sourceMessageA')::uuid;
    contradiction_source_b := (output_item->>'sourceMessageB')::uuid;

    if (
      select count(*)
      from public.discovery_messages
      where session_id = target_session.id
        and id in (contradiction_source_a, contradiction_source_b)
        and role = 'user'
    ) <> 2 then
      raise exception 'discovery_invalid_source_message';
    end if;

    insert into public.discovery_contradictions (
      session_id,
      organization_id,
      project_id,
      external_key,
      dimension,
      statement_a,
      statement_b,
      source_message_a_id,
      source_message_b_id,
      severity,
      resolution_question,
      affected_artifacts,
      status,
      created_by_agent_run_id,
      updated_at
    )
    values (
      target_session.id,
      target_session.organization_id,
      target_session.project_id,
      output_item->>'id',
      output_item->>'dimension',
      trim(output_item->>'statementA'),
      trim(output_item->>'statementB'),
      contradiction_source_a,
      contradiction_source_b,
      output_item->>'severity',
      trim(output_item->>'resolutionQuestion'),
      array(
        select artifact_name
        from jsonb_array_elements_text(output_item->'affectedArtifacts')
          as artifact_values(artifact_name)
      ),
      'open',
      target_run.id,
      now()
    )
    on conflict (session_id, external_key) do update
    set
      dimension = excluded.dimension,
      statement_a = excluded.statement_a,
      statement_b = excluded.statement_b,
      source_message_a_id = excluded.source_message_a_id,
      source_message_b_id = excluded.source_message_b_id,
      severity = excluded.severity,
      resolution_question = excluded.resolution_question,
      affected_artifacts = excluded.affected_artifacts,
      status = 'open',
      created_by_agent_run_id = excluded.created_by_agent_run_id,
      reviewed_by = null,
      reviewed_at = null,
      updated_at = now()
    where public.discovery_contradictions.reviewed_at is null;
  end loop;

  for output_item in
    select value
    from jsonb_array_elements(target_output->'coverage')
  loop
    if output_item->>'status' not in ('missing', 'partial', 'complete', 'not_applicable')
      or jsonb_typeof(coalesce(output_item->'satisfiedCriteria', '[]'::jsonb)) <> 'array'
      or jsonb_typeof(coalesce(output_item->'missingCriteria', '[]'::jsonb)) <> 'array'
      or jsonb_typeof(coalesce(output_item->'notApplicableCriteria', '[]'::jsonb)) <> 'array'
      or jsonb_typeof(coalesce(output_item->'evidence', '[]'::jsonb)) <> 'array'
      or nullif(trim(coalesce(output_item->>'rationale', '')), '') is null
      or coalesce((output_item->>'confidence')::numeric, -1) not between 0 and 1
    then
      raise exception 'discovery_invalid_coverage_output';
    end if;

    required_criteria := public.discovery_v2_criteria(output_item->>'dimension');
    satisfied_criteria := array(
      select value
      from jsonb_array_elements_text(output_item->'satisfiedCriteria')
    );
    missing_criteria := array(
      select value
      from jsonb_array_elements_text(output_item->'missingCriteria')
    );
    not_applicable_criteria := array(
      select item->>'key'
      from jsonb_array_elements(output_item->'notApplicableCriteria') as criteria(item)
    );
    referenced_criteria := coalesce(satisfied_criteria, '{}'::text[])
      || coalesce(missing_criteria, '{}'::text[])
      || coalesce(not_applicable_criteria, '{}'::text[]);

    if required_criteria is null
      or cardinality(referenced_criteria) <> cardinality(required_criteria)
      or (
        select count(distinct criterion)
        from unnest(referenced_criteria) as referenced(criterion)
      ) <> cardinality(required_criteria)
      or exists (
        select 1
        from unnest(referenced_criteria) as referenced(criterion)
        where criterion <> all(required_criteria)
      )
      or exists (
        select 1
        from jsonb_array_elements(output_item->'notApplicableCriteria') as criteria(item)
        where nullif(trim(item->>'key'), '') is null
          or nullif(trim(item->>'reason'), '') is null
      )
    then
      raise exception 'discovery_invalid_coverage_criteria';
    end if;

    if output_item->>'status' = 'complete'
      and cardinality(missing_criteria) > 0
    then
      raise exception 'discovery_invalid_coverage_status';
    elsif output_item->>'status' = 'missing'
      and (
        cardinality(satisfied_criteria) > 0
        or cardinality(not_applicable_criteria) > 0
      )
    then
      raise exception 'discovery_invalid_coverage_status';
    elsif output_item->>'status' = 'partial'
      and (
        cardinality(satisfied_criteria) = 0
        or cardinality(missing_criteria) = 0
      )
    then
      raise exception 'discovery_invalid_coverage_status';
    elsif output_item->>'status' = 'not_applicable'
      and (
        output_item->>'dimension' <> all(public.discovery_v2_not_applicable_dimensions())
        or cardinality(satisfied_criteria) > 0
        or cardinality(missing_criteria) > 0
        or cardinality(not_applicable_criteria) <> cardinality(required_criteria)
        or char_length(trim(output_item->>'rationale')) < 20
      )
    then
      raise exception 'discovery_invalid_coverage_status';
    end if;

    evidence_criteria := array(
      select item->>'criterionKey'
      from jsonb_array_elements(output_item->'evidence') as evidence_items(item)
    );

    foreach criterion_name in array satisfied_criteria
    loop
      if not (criterion_name = any(coalesce(evidence_criteria, '{}'::text[]))) then
        raise exception 'discovery_coverage_evidence_required';
      end if;
    end loop;

    for evidence_item in
      select value
      from jsonb_array_elements(output_item->'evidence')
    loop
      if evidence_item->>'criterionKey' <> all(coalesce(satisfied_criteria, '{}'::text[]))
        or nullif(trim(evidence_item->>'statement'), '') is null
        or jsonb_typeof(evidence_item->'sourceMessageIds') <> 'array'
        or jsonb_array_length(evidence_item->'sourceMessageIds') not between 1 and 12
      then
        raise exception 'discovery_invalid_coverage_evidence';
      end if;

      evidence_source_ids := array(
        select source_id::uuid
        from jsonb_array_elements_text(evidence_item->'sourceMessageIds') as source_values(source_id)
      );

      if (
        select count(distinct id)
        from public.discovery_messages
        where session_id = target_session.id
          and id = any(evidence_source_ids)
          and role = 'user'
      ) <> cardinality(evidence_source_ids) then
        raise exception 'discovery_invalid_source_message';
      end if;
    end loop;

    insert into public.discovery_coverage (
      session_id,
      organization_id,
      project_id,
      dimension,
      status,
      satisfied_criteria,
      missing_criteria,
      not_applicable_criteria,
      evidence,
      rationale,
      confidence,
      evaluated_by_agent_run_id,
      updated_at
    )
    values (
      target_session.id,
      target_session.organization_id,
      target_session.project_id,
      output_item->>'dimension',
      output_item->>'status',
      coalesce(output_item->'satisfiedCriteria', '[]'::jsonb),
      coalesce(output_item->'missingCriteria', '[]'::jsonb),
      coalesce(output_item->'notApplicableCriteria', '[]'::jsonb),
      coalesce(output_item->'evidence', '[]'::jsonb),
      trim(coalesce(output_item->>'rationale', '')),
      coalesce((output_item->>'confidence')::numeric, 0),
      target_run.id,
      now()
    )
    on conflict (session_id, dimension) do update
    set
      status = excluded.status,
      satisfied_criteria = excluded.satisfied_criteria,
      missing_criteria = excluded.missing_criteria,
      not_applicable_criteria = excluded.not_applicable_criteria,
      evidence = excluded.evidence,
      rationale = excluded.rationale,
      confidence = excluded.confidence,
      evaluated_by_agent_run_id = excluded.evaluated_by_agent_run_id,
      updated_at = now();
  end loop;

  for output_item in
    select value
    from jsonb_array_elements(target_output->'artifactReadiness')
  loop
    update public.discovery_artifact_readiness
    set
      agent_status = output_item->>'status',
      updated_at = now()
    where session_id = target_session.id
      and artifact_type = output_item->>'artifact';
  end loop;

  perform public.refresh_discovery_artifact_readiness(
    target_session.id,
    target_run.id
  );

  select round(
    100 * avg(
      case status
        when 'complete' then 1.0
        when 'not_applicable' then 1.0
        when 'partial' then 0.5
        else 0.0
      end
    ),
    2
  )
  into coverage_score
  from public.discovery_coverage
  where session_id = target_session.id;

  update public.discovery_sessions
  set
    summary = trim(target_output->>'understandingSummary'),
    current_coverage_score = coalesce(coverage_score, 0),
    active_turn_id = null,
    active_turn_started_at = null,
    active_turn_user_message_id = null,
    last_agent_run_id = target_run.id,
    lock_version = lock_version + 1,
    updated_at = now()
  where id = target_session.id;

  perform public.discovery_v2_append_event(
    target_session.id,
    'agent.output_recorded',
    auth.uid(),
    target_run.id,
    target_run.correlation_id,
    jsonb_build_object(
      'turnId', target_turn_id,
      'assistantMessageId', assistant_message_id,
      'coverageScore', coalesce(coverage_score, 0)
    )
  );

  perform public.discovery_v2_append_event(
    target_session.id,
    'turn.completed',
    auth.uid(),
    target_run.id,
    target_run.correlation_id,
    jsonb_build_object('turnId', target_turn_id)
  );

  return assistant_message_id;
end;
$$;

create or replace function public.fail_discovery_turn(
  target_session_id uuid,
  target_turn_id uuid,
  target_agent_run_id uuid default null,
  target_failure_code text default 'discovery_turn_failed'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session public.discovery_sessions%rowtype;
  target_run public.agent_runs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select *
  into target_session
  from public.discovery_sessions
  where id = target_session_id
  for update;

  if target_session.id is null then
    raise exception 'discovery_session_not_found';
  end if;

  if not public.is_org_member(target_session.organization_id) then
    raise exception 'project_access_denied';
  end if;

  if target_session.active_turn_id is distinct from target_turn_id then
    raise exception 'discovery_stale_turn';
  end if;

  if not public.is_org_admin(target_session.organization_id)
    and not exists (
      select 1
      from public.discovery_messages
      where id = target_session.active_turn_user_message_id
        and session_id = target_session.id
        and created_by = auth.uid()
    )
  then
    raise exception 'discovery_turn_owner_mismatch';
  end if;

  if target_agent_run_id is not null then
    select *
    into target_run
    from public.agent_runs
    where id = target_agent_run_id;

    if target_run.id is null
      or target_run.project_id <> target_session.project_id
      or target_run.agent_key <> 'discovery'
    then
      raise exception 'discovery_agent_run_mismatch';
    end if;
  end if;

  update public.discovery_sessions
  set
    active_turn_id = null,
    active_turn_started_at = null,
    active_turn_user_message_id = null,
    lock_version = lock_version + 1,
    updated_at = now()
  where id = target_session.id;

  perform public.discovery_v2_append_event(
    target_session.id,
    'turn.failed',
    auth.uid(),
    target_agent_run_id,
    target_run.correlation_id,
    jsonb_build_object(
      'turnId', target_turn_id,
      'failureCode', coalesce(nullif(trim(target_failure_code), ''), 'discovery_turn_failed')
    )
  );
end;
$$;

create or replace function public.recover_stale_discovery_turn(
  target_project_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session public.discovery_sessions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select sessions.*
  into target_session
  from public.discovery_sessions as sessions
  where sessions.project_id = target_project_id
  for update;

  if target_session.id is null then
    return false;
  end if;

  if not public.is_org_member(target_session.organization_id) then
    raise exception 'project_access_denied';
  end if;

  if target_session.active_turn_id is null
    or target_session.active_turn_started_at >= now() - interval '15 minutes'
  then
    return false;
  end if;

  perform public.discovery_v2_append_event(
    target_session.id,
    'turn.recovered',
    auth.uid(),
    null,
    null,
    jsonb_build_object(
      'turnId', target_session.active_turn_id,
      'reason', 'stale_turn_recovered'
    )
  );

  update public.discovery_sessions
  set
    active_turn_id = null,
    active_turn_started_at = null,
    active_turn_user_message_id = null,
    lock_version = lock_version + 1,
    updated_at = now()
  where id = target_session.id;

  return true;
end;
$$;

create or replace function public.review_discovery_knowledge(
  target_knowledge_id uuid,
  target_status text,
  target_review_note text default null,
  target_superseded_by uuid default null
)
returns public.discovery_knowledge
language plpgsql
security definer
set search_path = public
as $$
declare
  target_knowledge public.discovery_knowledge%rowtype;
  actor_is_admin boolean;
  owns_all_sources boolean;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select *
  into target_knowledge
  from public.discovery_knowledge
  where id = target_knowledge_id
  for update;

  if target_knowledge.id is null then
    raise exception 'discovery_knowledge_not_found';
  end if;

  if not public.is_org_member(target_knowledge.organization_id) then
    raise exception 'project_access_denied';
  end if;

  actor_is_admin := public.is_org_admin(target_knowledge.organization_id);

  select count(*) = cardinality(target_knowledge.source_message_ids)
  into owns_all_sources
  from public.discovery_messages
  where session_id = target_knowledge.session_id
    and id = any(target_knowledge.source_message_ids)
    and role = 'user'
    and created_by = auth.uid();

  if not actor_is_admin and not owns_all_sources then
    raise exception 'discovery_review_not_allowed';
  end if;

  if target_status not in ('confirmed', 'rejected', 'superseded') then
    raise exception 'discovery_invalid_knowledge_status';
  end if;

  if target_status = 'superseded' then
    if not actor_is_admin then
      raise exception 'organization_admin_required';
    end if;

    if target_superseded_by is null or not exists (
      select 1
      from public.discovery_knowledge
      where id = target_superseded_by
        and session_id = target_knowledge.session_id
    ) then
      raise exception 'discovery_invalid_superseding_knowledge';
    end if;
  end if;

  update public.discovery_knowledge
  set
    validation_status = target_status,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    review_note = nullif(trim(target_review_note), ''),
    superseded_by = case when target_status = 'superseded' then target_superseded_by else null end,
    updated_at = now()
  where id = target_knowledge.id
  returning * into target_knowledge;

  perform public.discovery_v2_append_event(
    target_knowledge.session_id,
    'knowledge.' || target_status,
    auth.uid(),
    target_knowledge.agent_run_id,
    null,
    jsonb_build_object(
      'knowledgeId', target_knowledge.id,
      'reviewNote', target_knowledge.review_note
    )
  );

  return target_knowledge;
end;
$$;

create or replace function public.review_discovery_gap(
  target_gap_id uuid,
  target_status text,
  target_resolution_note text default null,
  target_accepted_consequence text default null
)
returns public.discovery_gaps
language plpgsql
security definer
set search_path = public
as $$
declare
  target_gap public.discovery_gaps%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select *
  into target_gap
  from public.discovery_gaps
  where id = target_gap_id
  for update;

  if target_gap.id is null then
    raise exception 'discovery_gap_not_found';
  end if;

  if not public.is_org_admin(target_gap.organization_id) then
    raise exception 'organization_admin_required';
  end if;

  if target_status not in ('resolved', 'deferred', 'accepted_open', 'superseded') then
    raise exception 'discovery_invalid_gap_status';
  end if;

  if target_status = 'accepted_open'
    and nullif(trim(target_accepted_consequence), '') is null
  then
    raise exception 'discovery_accepted_consequence_required';
  end if;

  update public.discovery_gaps
  set
    status = target_status,
    resolution_note = nullif(trim(target_resolution_note), ''),
    accepted_consequence = case
      when target_status = 'accepted_open' then trim(target_accepted_consequence)
      else null
    end,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  where id = target_gap.id
  returning * into target_gap;

  perform public.refresh_discovery_artifact_readiness(
    target_gap.session_id,
    target_gap.created_by_agent_run_id
  );

  perform public.discovery_v2_append_event(
    target_gap.session_id,
    'gap.' || target_status,
    auth.uid(),
    target_gap.created_by_agent_run_id,
    null,
    jsonb_build_object(
      'gapId', target_gap.id,
      'resolutionNote', target_gap.resolution_note,
      'acceptedConsequence', target_gap.accepted_consequence
    )
  );

  return target_gap;
end;
$$;

create or replace function public.review_discovery_contradiction(
  target_contradiction_id uuid,
  target_status text,
  target_resolution_note text default null
)
returns public.discovery_contradictions
language plpgsql
security definer
set search_path = public
as $$
declare
  target_contradiction public.discovery_contradictions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select *
  into target_contradiction
  from public.discovery_contradictions
  where id = target_contradiction_id
  for update;

  if target_contradiction.id is null then
    raise exception 'discovery_contradiction_not_found';
  end if;

  if not public.is_org_admin(target_contradiction.organization_id) then
    raise exception 'organization_admin_required';
  end if;

  if target_status not in ('resolved', 'dismissed', 'superseded') then
    raise exception 'discovery_invalid_contradiction_status';
  end if;

  if target_status = 'resolved'
    and nullif(trim(target_resolution_note), '') is null
  then
    raise exception 'discovery_resolution_note_required';
  end if;

  update public.discovery_contradictions
  set
    status = target_status,
    resolution_note = nullif(trim(target_resolution_note), ''),
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now()
  where id = target_contradiction.id
  returning * into target_contradiction;

  perform public.refresh_discovery_artifact_readiness(
    target_contradiction.session_id,
    target_contradiction.created_by_agent_run_id
  );

  perform public.discovery_v2_append_event(
    target_contradiction.session_id,
    'contradiction.' || target_status,
    auth.uid(),
    target_contradiction.created_by_agent_run_id,
    null,
    jsonb_build_object(
      'contradictionId', target_contradiction.id,
      'resolutionNote', target_contradiction.resolution_note
    )
  );

  return target_contradiction;
end;
$$;

create or replace function public.complete_discovery_session(
  target_session_id uuid,
  target_status text,
  target_summary_confirmed boolean default false,
  target_open_items_acknowledged boolean default false,
  target_completion_reason text default null
)
returns public.discovery_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session public.discovery_sessions%rowtype;
  core_incomplete_count integer;
  missing_dimension_count integer;
  incomplete_dimension_count integer;
  critical_open_count integer;
  high_or_critical_open_count integer;
  open_contradiction_count integer;
  unresolved_gap_count integer;
  usable_artifact_count integer;
  total_usable_artifact_count integer;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select *
  into target_session
  from public.discovery_sessions
  where id = target_session_id
  for update;

  if target_session.id is null then
    raise exception 'discovery_session_not_found';
  end if;

  if not public.is_org_admin(target_session.organization_id) then
    raise exception 'organization_admin_required';
  end if;

  if target_session.active_turn_id is not null then
    raise exception 'discovery_turn_in_progress';
  end if;

  if target_status not in (
    'ready_for_review',
    'completed',
    'completed_with_open_items',
    'abandoned'
  ) then
    raise exception 'discovery_invalid_completion_status';
  end if;

  perform public.refresh_discovery_artifact_readiness(
    target_session.id,
    target_session.last_agent_run_id
  );

  select count(*)::integer
  into core_incomplete_count
  from public.discovery_coverage
  where session_id = target_session.id
    and dimension in ('problem', 'goals', 'users', 'workflow')
    and status <> 'complete';

  select count(*)::integer
  into missing_dimension_count
  from public.discovery_coverage
  where session_id = target_session.id
    and status = 'missing';

  select count(*)::integer
  into incomplete_dimension_count
  from public.discovery_coverage
  where session_id = target_session.id
    and status not in ('complete', 'not_applicable');

  select count(*)::integer
  into critical_open_count
  from (
    select severity
    from public.discovery_gaps
    where session_id = target_session.id and status = 'open'
    union all
    select severity
    from public.discovery_contradictions
    where session_id = target_session.id and status = 'open'
  ) as issues
  where severity = 'critical';

  select count(*)::integer
  into high_or_critical_open_count
  from public.discovery_gaps
  where session_id = target_session.id
    and status in ('open', 'deferred')
    and severity in ('high', 'critical');

  select count(*)::integer
  into open_contradiction_count
  from public.discovery_contradictions
  where session_id = target_session.id
    and status = 'open';

  select count(*)::integer
  into unresolved_gap_count
  from public.discovery_gaps
  where session_id = target_session.id
    and status in ('open', 'deferred');

  select count(*)::integer
  into usable_artifact_count
  from public.discovery_artifact_readiness
  where session_id = target_session.id
    and status in ('usable', 'ready');

  select count(*)::integer
  into total_usable_artifact_count
  from public.discovery_artifact_readiness
  where session_id = target_session.id
    and status in ('usable', 'ready');

  if target_status = 'ready_for_review' then
    if core_incomplete_count > 0
      or missing_dimension_count > 0
      or critical_open_count > 0
      or usable_artifact_count < 6
    then
      raise exception 'discovery_not_ready_for_review';
    end if;
  elsif target_status = 'completed' then
    if incomplete_dimension_count > 0
      or high_or_critical_open_count > 0
      or open_contradiction_count > 0
      or total_usable_artifact_count <> 8
      or not coalesce(target_summary_confirmed, false)
    then
      raise exception 'discovery_not_ready_for_completion';
    end if;
  elsif target_status = 'completed_with_open_items' then
    if missing_dimension_count > 0
      or critical_open_count > 0
      or unresolved_gap_count > 0
      or open_contradiction_count > 0
      or usable_artifact_count < 6
      or not coalesce(target_open_items_acknowledged, false)
      or nullif(trim(target_completion_reason), '') is null
    then
      raise exception 'discovery_open_items_completion_not_allowed';
    end if;
  end if;

  update public.discovery_sessions
  set
    status = target_status,
    ready_for_review_at = case
      when target_status = 'ready_for_review' then now()
      else ready_for_review_at
    end,
    completed_at = case
      when target_status in ('completed', 'completed_with_open_items', 'abandoned') then now()
      else null
    end,
    completed_by = case
      when target_status in ('completed', 'completed_with_open_items', 'abandoned') then auth.uid()
      else null
    end,
    completion_reason = nullif(trim(target_completion_reason), ''),
    lock_version = lock_version + 1,
    updated_at = now()
  where id = target_session.id
  returning * into target_session;

  perform public.discovery_v2_append_event(
    target_session.id,
    'session.' || target_status,
    auth.uid(),
    target_session.last_agent_run_id,
    null,
    jsonb_build_object(
      'summaryConfirmed', coalesce(target_summary_confirmed, false),
      'openItemsAcknowledged', coalesce(target_open_items_acknowledged, false),
      'completionReason', target_session.completion_reason
    )
  );

  return target_session;
end;
$$;

create or replace function public.reopen_discovery_session(
  target_session_id uuid,
  target_reason text
)
returns public.discovery_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session public.discovery_sessions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select *
  into target_session
  from public.discovery_sessions
  where id = target_session_id
  for update;

  if target_session.id is null then
    raise exception 'discovery_session_not_found';
  end if;

  if not public.is_org_admin(target_session.organization_id) then
    raise exception 'organization_admin_required';
  end if;

  if target_session.active_turn_id is not null then
    raise exception 'discovery_turn_in_progress';
  end if;

  if target_session.status not in (
    'ready_for_review',
    'completed',
    'completed_with_open_items',
    'abandoned'
  ) then
    raise exception 'discovery_session_not_closed';
  end if;

  if nullif(trim(target_reason), '') is null then
    raise exception 'discovery_reopen_reason_required';
  end if;

  update public.discovery_sessions
  set
    status = 'in_progress',
    ready_for_review_at = null,
    completed_at = null,
    completed_by = null,
    completion_reason = null,
    lock_version = lock_version + 1,
    updated_at = now()
  where id = target_session.id
  returning * into target_session;

  perform public.discovery_v2_append_event(
    target_session.id,
    'session.reopened',
    auth.uid(),
    target_session.last_agent_run_id,
    null,
    jsonb_build_object('reason', trim(target_reason))
  );

  return target_session;
end;
$$;

create or replace function public.get_discovery_runtime_context(
  target_project_id uuid,
  target_message_limit integer default 12
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session public.discovery_sessions%rowtype;
  effective_message_limit integer;
  result jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select *
  into target_session
  from public.ensure_discovery_session(target_project_id);

  if not public.is_org_member(target_session.organization_id) then
    raise exception 'project_access_denied';
  end if;

  effective_message_limit := greatest(1, least(coalesce(target_message_limit, 12), 30));

  select jsonb_build_object(
    'session', to_jsonb(target_session),
    'messages', coalesce((
      select jsonb_agg(to_jsonb(recent_messages) order by recent_messages.sequence_number)
      from (
        select
          messages.id,
          messages.turn_id,
          messages.role,
          messages.content,
          messages.sequence_number,
          messages.agent_run_id,
          messages.correlation_id,
          messages.created_by,
          messages.created_at
        from public.discovery_messages as messages
        where messages.session_id = target_session.id
        order by messages.sequence_number desc
        limit effective_message_limit
      ) as recent_messages
    ), '[]'::jsonb),
    'knowledge', coalesce((
      select jsonb_agg(to_jsonb(knowledge_rows) order by knowledge_rows.created_at)
      from (
        select *
        from public.discovery_knowledge
        where session_id = target_session.id
          and validation_status not in ('rejected', 'superseded')
      ) as knowledge_rows
    ), '[]'::jsonb),
    'gaps', coalesce((
      select jsonb_agg(to_jsonb(gap_rows) order by gap_rows.created_at)
      from (
        select *
        from public.discovery_gaps
        where session_id = target_session.id
          and status in ('open', 'deferred', 'accepted_open')
      ) as gap_rows
    ), '[]'::jsonb),
    'contradictions', coalesce((
      select jsonb_agg(to_jsonb(contradiction_rows) order by contradiction_rows.created_at)
      from (
        select *
        from public.discovery_contradictions
        where session_id = target_session.id
          and status = 'open'
      ) as contradiction_rows
    ), '[]'::jsonb),
    'coverage', coalesce((
      select jsonb_agg(
        to_jsonb(coverage_rows)
        order by array_position(public.discovery_v2_dimensions(), coverage_rows.dimension)
      )
      from (
        select *
        from public.discovery_coverage
        where session_id = target_session.id
      ) as coverage_rows
    ), '[]'::jsonb),
    'artifactReadiness', coalesce((
      select jsonb_agg(
        to_jsonb(readiness_rows)
        order by array_position(public.discovery_v2_artifacts(), readiness_rows.artifact_type)
      )
      from (
        select *
        from public.discovery_artifact_readiness
        where session_id = target_session.id
      ) as readiness_rows
    ), '[]'::jsonb)
  )
  into result;

  return result;
end;
$$;

alter table public.discovery_sessions enable row level security;
alter table public.discovery_messages enable row level security;
alter table public.discovery_knowledge enable row level security;
alter table public.discovery_gaps enable row level security;
alter table public.discovery_contradictions enable row level security;
alter table public.discovery_coverage enable row level security;
alter table public.discovery_artifact_readiness enable row level security;
alter table public.discovery_events enable row level security;

create policy "Members can read discovery sessions"
on public.discovery_sessions
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "Members can read discovery messages"
on public.discovery_messages
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "Members can read discovery knowledge"
on public.discovery_knowledge
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "Members can read discovery gaps"
on public.discovery_gaps
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "Members can read discovery contradictions"
on public.discovery_contradictions
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "Members can read discovery coverage"
on public.discovery_coverage
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "Members can read discovery artifact readiness"
on public.discovery_artifact_readiness
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "Members can read discovery events"
on public.discovery_events
for select
to authenticated
using (public.is_org_member(organization_id));

revoke all privileges on table
  public.discovery_sessions,
  public.discovery_messages,
  public.discovery_knowledge,
  public.discovery_gaps,
  public.discovery_contradictions,
  public.discovery_coverage,
  public.discovery_artifact_readiness,
  public.discovery_events
from anon, authenticated;

grant select on table
  public.discovery_sessions,
  public.discovery_messages,
  public.discovery_knowledge,
  public.discovery_gaps,
  public.discovery_contradictions,
  public.discovery_coverage,
  public.discovery_artifact_readiness,
  public.discovery_events
to authenticated;

revoke all privileges on function public.ensure_discovery_session(uuid)
from public, anon;
grant execute on function public.ensure_discovery_session(uuid)
to authenticated;

revoke all privileges on function public.start_discovery_turn(uuid, text, uuid)
from public, anon;
grant execute on function public.start_discovery_turn(uuid, text, uuid)
to authenticated;

revoke all privileges on function public.record_discovery_agent_output(uuid, uuid, uuid, jsonb)
from public, anon;
grant execute on function public.record_discovery_agent_output(uuid, uuid, uuid, jsonb)
to authenticated;

revoke all privileges on function public.fail_discovery_turn(uuid, uuid, uuid, text)
from public, anon;
grant execute on function public.fail_discovery_turn(uuid, uuid, uuid, text)
to authenticated;

revoke all privileges on function public.recover_stale_discovery_turn(uuid)
from public, anon;
grant execute on function public.recover_stale_discovery_turn(uuid)
to authenticated;

revoke all privileges on function public.review_discovery_knowledge(uuid, text, text, uuid)
from public, anon;
grant execute on function public.review_discovery_knowledge(uuid, text, text, uuid)
to authenticated;

revoke all privileges on function public.review_discovery_gap(uuid, text, text, text)
from public, anon;
grant execute on function public.review_discovery_gap(uuid, text, text, text)
to authenticated;

revoke all privileges on function public.review_discovery_contradiction(uuid, text, text)
from public, anon;
grant execute on function public.review_discovery_contradiction(uuid, text, text)
to authenticated;

revoke all privileges on function public.complete_discovery_session(uuid, text, boolean, boolean, text)
from public, anon;
grant execute on function public.complete_discovery_session(uuid, text, boolean, boolean, text)
to authenticated;

revoke all privileges on function public.reopen_discovery_session(uuid, text)
from public, anon;
grant execute on function public.reopen_discovery_session(uuid, text)
to authenticated;

revoke all privileges on function public.get_discovery_runtime_context(uuid, integer)
from public, anon;
grant execute on function public.get_discovery_runtime_context(uuid, integer)
to authenticated;

revoke all privileges on function public.discovery_v2_criteria(text)
from public, anon, authenticated;

revoke all privileges on function public.discovery_v2_not_applicable_dimensions()
from public, anon, authenticated;

revoke all privileges on function public.refresh_discovery_artifact_readiness(uuid, uuid)
from public, anon, authenticated;

revoke all privileges on function public.discovery_v2_append_event(uuid, text, uuid, uuid, uuid, jsonb)
from public, anon, authenticated;

create or replace function public.platform_readiness_check()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'database', 'ok',
    'schemaVersion', '0015',
    'checkedAt', now()
  );
$$;

comment on table public.discovery_sessions is
  'Canonical governed discovery session for one project.';
comment on table public.discovery_messages is
  'Immutable user and assistant evidence for conversational discovery.';
comment on table public.discovery_knowledge is
  'Traceable structured knowledge extracted from discovery messages.';
comment on table public.discovery_coverage is
  'Current governed coverage assessment for all thirteen discovery dimensions.';
comment on table public.discovery_artifact_readiness is
  'Deterministically recalculated readiness for the eight technical artifacts.';
comment on function public.start_discovery_turn is
  'Atomically records an idempotent user message and reserves the canonical discovery turn.';
comment on function public.record_discovery_agent_output is
  'Persists a validated discovery.v2 output and releases the active turn.';
comment on function public.complete_discovery_session is
  'Recalculates completion eligibility independently of the model recommendation.';

commit;
