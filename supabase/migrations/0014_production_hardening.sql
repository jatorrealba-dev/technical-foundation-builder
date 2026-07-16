begin;

create extension if not exists "pgcrypto";

alter table public.agent_runs
add column if not exists organization_id uuid
references public.organizations(id)
on delete cascade;

update public.agent_runs as runs
set organization_id = projects.organization_id
from public.projects
where projects.id = runs.project_id
  and runs.organization_id is null;

alter table public.agent_runs
alter column organization_id set not null;

alter table public.agent_runs
add column if not exists correlation_id uuid not null default gen_random_uuid();

alter table public.agent_runs
add column if not exists failure_code text;

alter table public.agent_runs
add column if not exists timeout_seconds integer;

alter table public.agent_runs
add column if not exists policy_snapshot jsonb not null default '{}'::jsonb;

alter table public.agent_runs
drop constraint if exists agent_runs_timeout_seconds_valid;

alter table public.agent_runs
add constraint agent_runs_timeout_seconds_valid
check (
  timeout_seconds is null
  or timeout_seconds between 30 and 900
);

create index if not exists idx_agent_runs_organization_created
on public.agent_runs (
  organization_id,
  created_at desc
);

create index if not exists idx_agent_runs_organization_creator_created
on public.agent_runs (
  organization_id,
  created_by,
  created_at desc
);

create index if not exists idx_agent_runs_active_by_user
on public.agent_runs (
  organization_id,
  created_by,
  status
)
where status in ('queued', 'running');

create index if not exists idx_agent_runs_active_project_agent
on public.agent_runs (
  project_id,
  agent_key,
  status
)
where status in ('queued', 'running');

create unique index if not exists idx_agent_runs_correlation_id
on public.agent_runs (correlation_id);

create table if not exists public.organization_ai_policies (
  organization_id uuid primary key
    references public.organizations(id)
    on delete cascade,
  ai_enabled boolean not null default true,
  daily_run_limit_per_user integer not null default 20,
  monthly_token_limit bigint not null default 1000000,
  max_concurrent_runs_per_user integer not null default 1,
  max_concurrent_runs_per_project_agent integer not null default 1,
  run_timeout_seconds integer not null default 180,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint organization_ai_policies_daily_limit_valid
    check (daily_run_limit_per_user between 1 and 500),
  constraint organization_ai_policies_monthly_token_limit_valid
    check (monthly_token_limit between 1000 and 1000000000),
  constraint organization_ai_policies_user_concurrency_valid
    check (max_concurrent_runs_per_user between 1 and 10),
  constraint organization_ai_policies_agent_concurrency_valid
    check (max_concurrent_runs_per_project_agent between 1 and 10),
  constraint organization_ai_policies_timeout_valid
    check (run_timeout_seconds between 30 and 900)
);

insert into public.organization_ai_policies (organization_id)
select organizations.id
from public.organizations
on conflict (organization_id) do nothing;

create or replace function public.create_default_organization_ai_policy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.organization_ai_policies (organization_id)
  values (new.id)
  on conflict (organization_id) do nothing;

  return new;
end;
$$;

drop trigger if exists create_default_organization_ai_policy
on public.organizations;

create trigger create_default_organization_ai_policy
after insert on public.organizations
for each row
execute function public.create_default_organization_ai_policy();

alter table public.organization_ai_policies
enable row level security;

drop policy if exists
  "Members can read organization AI policies"
on public.organization_ai_policies;

create policy
  "Members can read organization AI policies"
on public.organization_ai_policies
for select
to authenticated
using (
  public.is_org_member(organization_id)
);

create or replace function public.update_organization_ai_policy(
  target_organization_id uuid,
  target_ai_enabled boolean,
  target_daily_run_limit_per_user integer,
  target_monthly_token_limit bigint,
  target_max_concurrent_runs_per_user integer,
  target_max_concurrent_runs_per_project_agent integer,
  target_run_timeout_seconds integer
)
returns public.organization_ai_policies
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  updated_policy public.organization_ai_policies%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select role
  into actor_role
  from public.organization_members
  where organization_id = target_organization_id
    and user_id = auth.uid();

  if actor_role is null or actor_role not in ('owner', 'admin') then
    raise exception 'organization_admin_required';
  end if;

  if target_daily_run_limit_per_user is null
    or target_daily_run_limit_per_user not between 1 and 500
  then
    raise exception 'invalid_daily_run_limit';
  end if;

  if target_monthly_token_limit is null
    or target_monthly_token_limit not between 1000 and 1000000000
  then
    raise exception 'invalid_monthly_token_limit';
  end if;

  if target_max_concurrent_runs_per_user is null
    or target_max_concurrent_runs_per_user not between 1 and 10
  then
    raise exception 'invalid_user_concurrency_limit';
  end if;

  if target_max_concurrent_runs_per_project_agent is null
    or target_max_concurrent_runs_per_project_agent not between 1 and 10
  then
    raise exception 'invalid_project_agent_concurrency_limit';
  end if;

  if target_run_timeout_seconds is null
    or target_run_timeout_seconds not between 30 and 900
  then
    raise exception 'invalid_run_timeout';
  end if;

  insert into public.organization_ai_policies (
    organization_id,
    ai_enabled,
    daily_run_limit_per_user,
    monthly_token_limit,
    max_concurrent_runs_per_user,
    max_concurrent_runs_per_project_agent,
    run_timeout_seconds,
    updated_by,
    updated_at
  )
  values (
    target_organization_id,
    coalesce(target_ai_enabled, false),
    target_daily_run_limit_per_user,
    target_monthly_token_limit,
    target_max_concurrent_runs_per_user,
    target_max_concurrent_runs_per_project_agent,
    target_run_timeout_seconds,
    auth.uid(),
    now()
  )
  on conflict (organization_id) do update
  set
    ai_enabled = excluded.ai_enabled,
    daily_run_limit_per_user = excluded.daily_run_limit_per_user,
    monthly_token_limit = excluded.monthly_token_limit,
    max_concurrent_runs_per_user = excluded.max_concurrent_runs_per_user,
    max_concurrent_runs_per_project_agent = excluded.max_concurrent_runs_per_project_agent,
    run_timeout_seconds = excluded.run_timeout_seconds,
    updated_by = auth.uid(),
    updated_at = now()
  returning * into updated_policy;

  return updated_policy;
end;
$$;

create or replace function public.recover_stale_agent_runs(
  target_organization_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_role text;
  recovered_count integer;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select role
  into actor_role
  from public.organization_members
  where organization_id = target_organization_id
    and user_id = auth.uid();

  if actor_role is null or actor_role not in ('owner', 'admin') then
    raise exception 'organization_admin_required';
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
        now() - make_interval(secs => coalesce(timeout_seconds, 180) + 60)
    returning id, correlation_id
  ), events as (
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
    from recovered
    returning id
  )
  select count(*)::integer
  into recovered_count
  from recovered;

  return coalesce(recovered_count, 0);
end;
$$;

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

create or replace function public.complete_agent_run(
  target_run_id uuid,
  target_output jsonb,
  target_input_tokens integer,
  target_output_tokens integer,
  target_total_tokens integer,
  target_latency_ms integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_run public.agent_runs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if coalesce(target_input_tokens, 0) < 0
    or coalesce(target_output_tokens, 0) < 0
    or coalesce(target_total_tokens, 0) < 0
    or coalesce(target_latency_ms, 0) < 0
  then
    raise exception 'invalid_agent_usage';
  end if;

  select *
  into target_run
  from public.agent_runs
  where id = target_run_id
  for update;

  if target_run.id is null or target_run.created_by <> auth.uid() then
    raise exception 'agent_run_not_found';
  end if;

  if target_run.status = 'completed' then
    return true;
  end if;

  if target_run.status <> 'running' then
    raise exception 'agent_run_not_running';
  end if;

  update public.agent_runs
  set
    status = 'completed',
    output = target_output,
    input_tokens = coalesce(target_input_tokens, 0),
    output_tokens = coalesce(target_output_tokens, 0),
    total_tokens = coalesce(target_total_tokens, 0),
    latency_ms = coalesce(target_latency_ms, 0),
    failure_code = null,
    error_message = null,
    completed_at = now(),
    updated_at = now()
  where id = target_run_id;

  insert into public.agent_run_events (
    run_id,
    event_type,
    payload
  )
  values (
    target_run_id,
    'run_completed',
    jsonb_build_object(
      'inputTokens', coalesce(target_input_tokens, 0),
      'outputTokens', coalesce(target_output_tokens, 0),
      'totalTokens', coalesce(target_total_tokens, 0),
      'latencyMs', coalesce(target_latency_ms, 0),
      'correlationId', target_run.correlation_id
    )
  );

  return true;
end;
$$;

create or replace function public.fail_agent_run(
  target_run_id uuid,
  target_failure_code text,
  target_error_message text,
  target_latency_ms integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target_run public.agent_runs%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select *
  into target_run
  from public.agent_runs
  where id = target_run_id
  for update;

  if target_run.id is null or target_run.created_by <> auth.uid() then
    raise exception 'agent_run_not_found';
  end if;

  if target_run.status = 'failed' then
    return true;
  end if;

  if target_run.status not in ('queued', 'running') then
    raise exception 'agent_run_not_active';
  end if;

  update public.agent_runs
  set
    status = 'failed',
    failure_code = left(coalesce(nullif(trim(target_failure_code), ''), 'agent_runtime_error'), 100),
    error_message = left(coalesce(nullif(trim(target_error_message), ''), 'La ejecución del agente falló.'), 1000),
    latency_ms = greatest(coalesce(target_latency_ms, 0), 0),
    completed_at = now(),
    updated_at = now()
  where id = target_run_id;

  insert into public.agent_run_events (
    run_id,
    event_type,
    payload
  )
  values (
    target_run_id,
    'run_failed',
    jsonb_build_object(
      'failureCode', left(coalesce(nullif(trim(target_failure_code), ''), 'agent_runtime_error'), 100),
      'latencyMs', greatest(coalesce(target_latency_ms, 0), 0),
      'correlationId', target_run.correlation_id
    )
  );

  return true;
end;
$$;

create or replace function public.get_organization_ai_usage(
  target_organization_id uuid
)
returns table (
  month_started_at timestamptz,
  monthly_runs bigint,
  monthly_completed_runs bigint,
  monthly_failed_runs bigint,
  monthly_total_tokens bigint,
  active_runs bigint,
  current_user_daily_runs bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if not public.is_org_member(target_organization_id) then
    raise exception 'organization_access_denied';
  end if;

  return query
  select
    date_trunc('month', now()),
    count(*) filter (
      where runs.created_at >= date_trunc('month', now())
    ),
    count(*) filter (
      where runs.created_at >= date_trunc('month', now())
        and runs.status = 'completed'
    ),
    count(*) filter (
      where runs.created_at >= date_trunc('month', now())
        and runs.status = 'failed'
    ),
    coalesce(sum(runs.total_tokens) filter (
      where runs.created_at >= date_trunc('month', now())
        and runs.status = 'completed'
    ), 0)::bigint,
    count(*) filter (
      where runs.status in ('queued', 'running')
    ),
    count(*) filter (
      where runs.created_by = auth.uid()
        and runs.created_at >= date_trunc('day', now())
    )
  from public.agent_runs as runs
  where runs.organization_id = target_organization_id;
end;
$$;

create or replace function public.platform_readiness_check()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'database', 'ok',
    'schemaVersion', '0014',
    'checkedAt', now()
  );
$$;

comment on table public.organization_ai_policies is
  'Organization-level AI execution policy, concurrency controls and usage budgets.';

comment on column public.agent_runs.correlation_id is
  'Stable identifier used to correlate structured application logs with a persisted agent run.';

comment on column public.agent_runs.policy_snapshot is
  'Immutable snapshot of the organization AI policy enforced when the run was reserved.';

comment on function public.reserve_agent_run is
  'Atomically enforces AI policy and reserves an active run before calling the provider.';

comment on function public.complete_agent_run is
  'Atomically completes an agent run and appends its terminal lifecycle event.';

comment on function public.fail_agent_run is
  'Atomically fails an active agent run and appends its terminal lifecycle event.';

revoke all privileges
on table public.organization_ai_policies
from anon, authenticated;

grant select
on table public.organization_ai_policies
to authenticated;

revoke all privileges
on function public.update_organization_ai_policy(
  uuid,
  boolean,
  integer,
  bigint,
  integer,
  integer,
  integer
)
from public, anon;

grant execute
on function public.update_organization_ai_policy(
  uuid,
  boolean,
  integer,
  bigint,
  integer,
  integer,
  integer
)
to authenticated;

revoke all privileges
on function public.reserve_agent_run(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  uuid
)
from public, anon;

grant execute
on function public.reserve_agent_run(
  uuid,
  text,
  text,
  text,
  text,
  jsonb,
  uuid
)
to authenticated;

revoke all privileges
on function public.complete_agent_run(
  uuid,
  jsonb,
  integer,
  integer,
  integer,
  integer
)
from public, anon;

grant execute
on function public.complete_agent_run(
  uuid,
  jsonb,
  integer,
  integer,
  integer,
  integer
)
to authenticated;

revoke all privileges
on function public.fail_agent_run(
  uuid,
  text,
  text,
  integer
)
from public, anon;

grant execute
on function public.fail_agent_run(
  uuid,
  text,
  text,
  integer
)
to authenticated;

revoke all privileges
on function public.get_organization_ai_usage(uuid)
from public, anon;

grant execute
on function public.get_organization_ai_usage(uuid)
to authenticated;

revoke all privileges
on function public.recover_stale_agent_runs(uuid)
from public, anon;

grant execute
on function public.recover_stale_agent_runs(uuid)
to authenticated;

revoke all privileges
on function public.platform_readiness_check()
from public;

grant execute
on function public.platform_readiness_check()
to anon, authenticated;

drop policy if exists
  "Members can create agent runs for accessible projects"
on public.agent_runs;

drop policy if exists
  "Members can update agent runs for accessible projects"
on public.agent_runs;

revoke insert, update
on table public.agent_runs
from authenticated;

grant select
on table public.agent_runs
to authenticated;

drop policy if exists
  "Members can create events for accessible agent runs"
on public.agent_run_events;

create policy
  "Members can append events for accessible agent runs"
on public.agent_run_events
for insert
to authenticated
with check (
  exists (
    select 1
    from public.agent_runs
    join public.projects
      on projects.id = agent_runs.project_id
    join public.organization_members
      on organization_members.organization_id = projects.organization_id
      and organization_members.user_id = auth.uid()
    where agent_runs.id = agent_run_events.run_id
      and (
        agent_runs.created_by = auth.uid()
        or organization_members.role in ('owner', 'admin')
      )
  )
);

commit;
