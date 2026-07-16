-- Production Hardening v10 verification queries.
-- Run in the Supabase SQL editor after applying migration 0014.

select
  organization_id,
  ai_enabled,
  daily_run_limit_per_user,
  monthly_token_limit,
  max_concurrent_runs_per_user,
  max_concurrent_runs_per_project_agent,
  run_timeout_seconds
from public.organization_ai_policies
order by created_at;

select
  id,
  organization_id,
  project_id,
  agent_key,
  status,
  correlation_id,
  failure_code,
  timeout_seconds,
  policy_snapshot,
  created_at
from public.agent_runs
order by created_at desc
limit 20;

select public.platform_readiness_check();

select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'reserve_agent_run',
    'complete_agent_run',
    'fail_agent_run',
    'recover_stale_agent_runs',
    'get_organization_ai_usage',
    'update_organization_ai_policy',
    'platform_readiness_check'
  )
order by routine_name;
