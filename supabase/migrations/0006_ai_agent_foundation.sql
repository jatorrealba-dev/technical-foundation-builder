begin;

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null
    references public.projects(id)
    on delete cascade,
  agent_key text not null,
  status text not null default 'queued',
  provider text not null default 'openai',
  model text not null,
  prompt_version text not null,
  input_snapshot jsonb not null default '{}'::jsonb,
  output jsonb,
  error_message text,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  latency_ms integer,
  created_by uuid not null
    references auth.users(id)
    on delete restrict,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint agent_runs_agent_key_valid
    check (
      agent_key in (
        'interview',
        'project_model',
        'architecture',
        'security',
        'consistency',
        'readiness'
      )
    ),

  constraint agent_runs_status_valid
    check (
      status in (
        'queued',
        'running',
        'completed',
        'failed',
        'cancelled'
      )
    ),

  constraint agent_runs_token_counts_non_negative
    check (
      coalesce(input_tokens, 0) >= 0
      and coalesce(output_tokens, 0) >= 0
      and coalesce(total_tokens, 0) >= 0
    ),

  constraint agent_runs_latency_non_negative
    check (coalesce(latency_ms, 0) >= 0)
);

create table if not exists public.agent_run_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null
    references public.agent_runs(id)
    on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_runs_project_created_at
on public.agent_runs (
  project_id,
  created_at desc
);

create index if not exists idx_agent_runs_project_agent_key
on public.agent_runs (
  project_id,
  agent_key,
  created_at desc
);

create index if not exists idx_agent_runs_status
on public.agent_runs (status);

create index if not exists idx_agent_run_events_run_created_at
on public.agent_run_events (
  run_id,
  created_at
);

comment on table public.agent_runs is
  'Auditable executions of AI agents for a project.';

comment on column public.agent_runs.prompt_version is
  'Version identifier of the code-owned prompt used for the run.';

comment on column public.agent_runs.input_snapshot is
  'Immutable structured context supplied to the agent for this run.';

comment on column public.agent_runs.output is
  'Validated structured output returned by the agent.';

comment on table public.agent_run_events is
  'Append-only lifecycle events associated with an AI agent run.';

alter table public.agent_runs
  enable row level security;

alter table public.agent_run_events
  enable row level security;

drop policy if exists
  "Members can read agent runs for accessible projects"
on public.agent_runs;

create policy
  "Members can read agent runs for accessible projects"
on public.agent_runs
for select
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = agent_runs.project_id
      and public.is_org_member(
        projects.organization_id
      )
  )
);

drop policy if exists
  "Members can create agent runs for accessible projects"
on public.agent_runs;

create policy
  "Members can create agent runs for accessible projects"
on public.agent_runs
for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.projects
    where projects.id = agent_runs.project_id
      and public.is_org_member(
        projects.organization_id
      )
  )
);

drop policy if exists
  "Members can update agent runs for accessible projects"
on public.agent_runs;

create policy
  "Members can update agent runs for accessible projects"
on public.agent_runs
for update
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = agent_runs.project_id
      and public.is_org_member(
        projects.organization_id
      )
  )
)
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.projects
    where projects.id = agent_runs.project_id
      and public.is_org_member(
        projects.organization_id
      )
  )
);

drop policy if exists
  "Members can read events for accessible agent runs"
on public.agent_run_events;

create policy
  "Members can read events for accessible agent runs"
on public.agent_run_events
for select
to authenticated
using (
  exists (
    select 1
    from public.agent_runs
    join public.projects
      on projects.id = agent_runs.project_id
    where agent_runs.id = agent_run_events.run_id
      and public.is_org_member(
        projects.organization_id
      )
  )
);

drop policy if exists
  "Members can create events for accessible agent runs"
on public.agent_run_events;

create policy
  "Members can create events for accessible agent runs"
on public.agent_run_events
for insert
to authenticated
with check (
  exists (
    select 1
    from public.agent_runs
    join public.projects
      on projects.id = agent_runs.project_id
    where agent_runs.id = agent_run_events.run_id
      and agent_runs.created_by = auth.uid()
      and public.is_org_member(
        projects.organization_id
      )
  )
);

revoke all privileges
on table public.agent_runs
from anon;

revoke all privileges
on table public.agent_run_events
from anon;

revoke all privileges
on table public.agent_runs
from authenticated;

revoke all privileges
on table public.agent_run_events
from authenticated;

grant select, insert, update
on table public.agent_runs
to authenticated;

grant select, insert
on table public.agent_run_events
to authenticated;

commit;
