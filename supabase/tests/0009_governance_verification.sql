-- Project Model Governance v5 verification
-- Safe, read-only checks for Supabase SQL Editor after migration 0009.

select
  to_regclass('public.project_model_change_sets') as change_sets_table,
  to_regclass('public.project_model_changes') as changes_table,
  to_regclass('public.project_artifact_states') as artifact_states_table;

select
  routine_name,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'create_project_model_change_set',
    'review_project_model_change',
    'apply_project_model_change_set',
    'create_and_apply_manual_project_model_change_set',
    'close_project_model_change_set',
    'capture_artifact_freshness'
  )
order by routine_name;

select
  event_object_table,
  trigger_name,
  action_timing,
  event_manipulation
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in (
    'capture_project_model_version_on_write',
    'capture_artifact_freshness_on_write'
  )
order by event_object_table, trigger_name, event_manipulation;

select
  tablename,
  policyname,
  cmd,
  roles
from pg_policies
where schemaname = 'public'
  and tablename in (
    'project_model_change_sets',
    'project_model_changes',
    'project_artifact_states'
  )
order by tablename, policyname;

select
  project_id,
  count(*) as change_set_count,
  count(*) filter (where status = 'reviewing') as reviewing,
  count(*) filter (where status = 'ready') as ready,
  count(*) filter (where status = 'applied') as applied,
  count(*) filter (where status = 'rejected') as rejected
from public.project_model_change_sets
group by project_id
order by project_id;

select
  change_set_id,
  count(*) as total_changes,
  count(*) filter (where decision = 'pending') as pending,
  count(*) filter (where decision = 'accepted') as accepted,
  count(*) filter (where decision = 'rejected') as rejected
from public.project_model_changes
group by change_set_id
order by change_set_id;

select
  project_id,
  artifact_type,
  status,
  based_on_model_version,
  reason,
  updated_at
from public.project_artifact_states
order by project_id, artifact_type;

select
  project_id,
  version_number,
  source_run_id,
  source_review_id,
  source_change_set_id,
  change_reason,
  created_at
from public.project_model_versions
order by project_id, version_number desc;

-- Expected privilege result:
-- authenticated can execute the five governance RPCs.
-- authenticated can no longer execute the legacy full-run apply RPC.
select
  p.proname,
  has_function_privilege(
    'authenticated',
    p.oid,
    'EXECUTE'
  ) as authenticated_can_execute
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'apply_approved_project_model_run',
    'create_project_model_change_set',
    'review_project_model_change',
    'apply_project_model_change_set',
    'create_and_apply_manual_project_model_change_set',
    'close_project_model_change_set'
  )
order by p.proname;
