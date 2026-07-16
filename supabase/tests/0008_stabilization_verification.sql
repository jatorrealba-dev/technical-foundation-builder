-- Read-only verification queries for migration 0008.
-- Run these in Supabase SQL Editor after `npx supabase db push`.

select
  version,
  name
from supabase_migrations.schema_migrations
where version = '0008';

select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'apply_approved_project_model_run',
    'restore_project_model_version',
    'capture_project_model_version'
  )
order by routine_name;

select
  projects.name as project_name,
  count(project_model_versions.id) as version_count,
  min(project_model_versions.version_number) as first_version,
  max(project_model_versions.version_number) as latest_version
from public.projects
join public.project_models
  on project_models.project_id = projects.id
left join public.project_model_versions
  on project_model_versions.project_id = projects.id
group by
  projects.id,
  projects.name
order by projects.name;

select
  agent_runs.agent_key,
  agent_run_reviews.decision,
  agent_run_reviews.application_status,
  count(*) as run_count
from public.agent_run_reviews
join public.agent_runs
  on agent_runs.id = agent_run_reviews.run_id
group by
  agent_runs.agent_key,
  agent_run_reviews.decision,
  agent_run_reviews.application_status
order by
  agent_runs.agent_key,
  agent_run_reviews.decision,
  agent_run_reviews.application_status;
