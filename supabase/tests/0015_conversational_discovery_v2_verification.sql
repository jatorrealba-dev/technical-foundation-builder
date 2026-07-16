-- Conversational Discovery v2 persistence verification.
-- Run in the Supabase SQL editor after applying migration 0015.

select public.platform_readiness_check();

select
  tablename as table_name,
  rowsecurity
from pg_catalog.pg_tables
where schemaname = 'public'
  and tablename in (
    'discovery_sessions',
    'discovery_messages',
    'discovery_knowledge',
    'discovery_gaps',
    'discovery_contradictions',
    'discovery_coverage',
    'discovery_artifact_readiness',
    'discovery_events'
  )
order by tablename;

select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'ensure_discovery_session',
    'start_discovery_turn',
    'record_discovery_agent_output',
    'fail_discovery_turn',
    'recover_stale_discovery_turn',
    'review_discovery_knowledge',
    'review_discovery_gap',
    'review_discovery_contradiction',
    'complete_discovery_session',
    'reopen_discovery_session',
    'get_discovery_runtime_context',
    'refresh_discovery_artifact_readiness',
    'discovery_v2_criteria',
    'discovery_v2_not_applicable_dimensions'
  )
order by routine_name;

select
  grantee,
  table_name,
  privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name like 'discovery_%'
order by table_name, grantee, privilege_type;

select
  sessions.id,
  sessions.project_id,
  sessions.status,
  sessions.turn_count,
  sessions.current_coverage_score,
  count(distinct coverage.dimension) as coverage_dimensions,
  count(distinct readiness.artifact_type) as artifact_readiness_rows
from public.discovery_sessions as sessions
left join public.discovery_coverage as coverage
  on coverage.session_id = sessions.id
left join public.discovery_artifact_readiness as readiness
  on readiness.session_id = sessions.id
group by sessions.id
order by sessions.created_at desc;

-- Expected platform readiness schemaVersion: 0015.
