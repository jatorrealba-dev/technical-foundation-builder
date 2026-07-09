create extension if not exists "pgcrypto";

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text not null default '',
  industry text not null default '',
  product_type text not null default 'saas',
  technical_level text not null default 'non_technical',
  main_goal text not null default '',
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'not_started',
  current_stage text not null default 'idea',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.interview_answers (
  id uuid primary key default gen_random_uuid(),
  interview_session_id uuid not null references public.interview_sessions(id) on delete cascade,
  question_id text not null,
  stage text not null,
  answer text not null,
  answered_at timestamptz not null default now(),
  unique (interview_session_id, question_id)
);

create table if not exists public.project_models (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  status text not null default 'generated',
  requirements jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  domain_entities jsonb not null default '[]'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  open_questions jsonb not null default '[]'::jsonb,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.artifacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  type text not null,
  title text not null,
  filename text not null,
  format text not null default 'markdown',
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, type)
);

create index if not exists idx_organization_members_user_id
on public.organization_members(user_id);

create index if not exists idx_organization_members_organization_id
on public.organization_members(organization_id);

create index if not exists idx_projects_organization_id
on public.projects(organization_id);

create index if not exists idx_projects_owner_id
on public.projects(owner_id);

create index if not exists idx_interview_sessions_project_id
on public.interview_sessions(project_id);

create index if not exists idx_interview_answers_session_id
on public.interview_answers(interview_session_id);

create index if not exists idx_project_models_project_id
on public.project_models(project_id);

create index if not exists idx_artifacts_project_id
on public.artifacts(project_id);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.projects enable row level security;
alter table public.interview_sessions enable row level security;
alter table public.interview_answers enable row level security;
alter table public.project_models enable row level security;
alter table public.artifacts enable row level security;

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_members.organization_id = target_organization_id
      and organization_members.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_members.organization_id = target_organization_id
      and organization_members.user_id = auth.uid()
      and organization_members.role in ('owner', 'admin')
  );
$$;

create policy "Users can create organizations"
on public.organizations
for insert
to authenticated
with check (true);

create policy "Users can read organizations they belong to"
on public.organizations
for select
to authenticated
using (public.is_org_member(id));

create policy "Organization admins can update organizations"
on public.organizations
for update
to authenticated
using (public.is_org_admin(id))
with check (public.is_org_admin(id));

create policy "Users can read their own memberships"
on public.organization_members
for select
to authenticated
using (user_id = auth.uid());

create policy "Organization admins can read memberships"
on public.organization_members
for select
to authenticated
using (public.is_org_admin(organization_id));

create policy "Users can create their first owner membership"
on public.organization_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'owner'
  and exists (
    select 1
    from public.organizations
    where organizations.id = organization_members.organization_id
  )
);

create policy "Organization admins can manage memberships"
on public.organization_members
for update
to authenticated
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "Organization admins can delete memberships"
on public.organization_members
for delete
to authenticated
using (public.is_org_admin(organization_id));

create policy "Users can read projects from their organizations"
on public.projects
for select
to authenticated
using (public.is_org_member(organization_id));

create policy "Users can create projects in their organizations"
on public.projects
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and public.is_org_member(organization_id)
);

create policy "Users can update projects from their organizations"
on public.projects
for update
to authenticated
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "Users can delete projects from their organizations"
on public.projects
for delete
to authenticated
using (public.is_org_admin(organization_id));

create policy "Users can manage interview sessions for accessible projects"
on public.interview_sessions
for all
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = interview_sessions.project_id
      and public.is_org_member(projects.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.projects
    where projects.id = interview_sessions.project_id
      and public.is_org_member(projects.organization_id)
  )
);

create policy "Users can manage interview answers for accessible projects"
on public.interview_answers
for all
to authenticated
using (
  exists (
    select 1
    from public.interview_sessions
    join public.projects on projects.id = interview_sessions.project_id
    where interview_sessions.id = interview_answers.interview_session_id
      and public.is_org_member(projects.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.interview_sessions
    join public.projects on projects.id = interview_sessions.project_id
    where interview_sessions.id = interview_answers.interview_session_id
      and public.is_org_member(projects.organization_id)
  )
);

create policy "Users can manage project models for accessible projects"
on public.project_models
for all
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = project_models.project_id
      and public.is_org_member(projects.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.projects
    where projects.id = project_models.project_id
      and public.is_org_member(projects.organization_id)
  )
);

create policy "Users can manage artifacts for accessible projects"
on public.artifacts
for all
to authenticated
using (
  exists (
    select 1
    from public.projects
    where projects.id = artifacts.project_id
      and public.is_org_member(projects.organization_id)
  )
)
with check (
  exists (
    select 1
    from public.projects
    where projects.id = artifacts.project_id
      and public.is_org_member(projects.organization_id)
  )
);
