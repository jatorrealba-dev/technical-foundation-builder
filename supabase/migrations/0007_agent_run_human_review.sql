begin;

create table if not exists public.agent_run_reviews (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique
    references public.agent_runs(id)
    on delete cascade,
  project_id uuid not null
    references public.projects(id)
    on delete cascade,
  decision text not null default 'pending',
  reviewer_comment text,
  reviewed_by uuid
    references auth.users(id)
    on delete set null,
  reviewed_at timestamptz,
  application_status text not null default 'not_applied',
  application_summary jsonb not null default '{}'::jsonb,
  applied_by uuid
    references auth.users(id)
    on delete set null,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint agent_run_reviews_decision_valid
    check (
      decision in (
        'pending',
        'approved',
        'rejected'
      )
    ),

  constraint agent_run_reviews_application_status_valid
    check (
      application_status in (
        'not_applied',
        'applied',
        'failed',
        'not_applicable'
      )
    ),

  constraint agent_run_reviews_comment_length
    check (
      reviewer_comment is null
      or char_length(reviewer_comment) <= 4000
    ),

  constraint agent_run_reviews_review_metadata_consistent
    check (
      (
        decision = 'pending'
        and reviewed_by is null
        and reviewed_at is null
      )
      or (
        decision in ('approved', 'rejected')
        and reviewed_by is not null
        and reviewed_at is not null
      )
    ),

  constraint agent_run_reviews_application_metadata_consistent
    check (
      (
        application_status <> 'applied'
      )
      or (
        applied_by is not null
        and applied_at is not null
      )
    )
);

create index if not exists
  idx_agent_run_reviews_project_updated_at
on public.agent_run_reviews (
  project_id,
  updated_at desc
);

create index if not exists
  idx_agent_run_reviews_decision
on public.agent_run_reviews (
  decision,
  updated_at desc
);

comment on table public.agent_run_reviews is
  'Human review and controlled application state for validated AI agent runs.';

comment on column public.agent_run_reviews.decision is
  'Human decision independent from the operational execution status of the agent run.';

comment on column public.agent_run_reviews.application_summary is
  'Auditable description of the project changes produced from an approved run.';

create or replace function public.ensure_agent_run_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and new.output is not null then
    insert into public.agent_run_reviews (
      run_id,
      project_id,
      decision,
      application_status,
      created_at,
      updated_at
    )
    values (
      new.id,
      new.project_id,
      'pending',
      case
        when new.agent_key = 'project_model'
          then 'not_applied'
        else 'not_applicable'
      end,
      coalesce(new.completed_at, new.updated_at, now()),
      coalesce(new.completed_at, new.updated_at, now())
    )
    on conflict (run_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all
on function public.ensure_agent_run_review()
from public;

drop trigger if exists
  ensure_agent_run_review_on_completion
on public.agent_runs;

create trigger ensure_agent_run_review_on_completion
after insert
or update of status, output
on public.agent_runs
for each row
execute function public.ensure_agent_run_review();

insert into public.agent_run_reviews (
  run_id,
  project_id,
  decision,
  application_status,
  created_at,
  updated_at
)
select
  agent_runs.id,
  agent_runs.project_id,
  'pending',
  case
    when agent_runs.agent_key = 'project_model'
      then 'not_applied'
    else 'not_applicable'
  end,
  coalesce(
    agent_runs.completed_at,
    agent_runs.updated_at,
    agent_runs.created_at
  ),
  coalesce(
    agent_runs.completed_at,
    agent_runs.updated_at,
    agent_runs.created_at
  )
from public.agent_runs
where agent_runs.status = 'completed'
  and agent_runs.output is not null
on conflict (run_id) do nothing;

alter table public.agent_run_reviews
  enable row level security;

drop policy if exists
  "Members can read agent run reviews for accessible projects"
on public.agent_run_reviews;

create policy
  "Members can read agent run reviews for accessible projects"
on public.agent_run_reviews
for select
to authenticated
using (
  public.is_org_member(
    (
      select projects.organization_id
      from public.projects
      where projects.id = agent_run_reviews.project_id
    )
  )
);

drop policy if exists
  "Admins can update agent run reviews for accessible projects"
on public.agent_run_reviews;

create policy
  "Admins can update agent run reviews for accessible projects"
on public.agent_run_reviews
for update
to authenticated
using (
  public.is_org_admin(
    (
      select projects.organization_id
      from public.projects
      where projects.id = agent_run_reviews.project_id
    )
  )
)
with check (
  public.is_org_admin(
    (
      select projects.organization_id
      from public.projects
      where projects.id = agent_run_reviews.project_id
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
      and public.is_org_member(
        projects.organization_id
      )
      and (
        agent_runs.created_by = auth.uid()
        or public.is_org_admin(
          projects.organization_id
        )
      )
  )
);

revoke all privileges
on table public.agent_run_reviews
from anon;

revoke all privileges
on table public.agent_run_reviews
from authenticated;

grant select, update
on table public.agent_run_reviews
to authenticated;

commit;
