-- Consistency Engine v6 read-only verification queries.
-- Execute in Supabase SQL Editor after migration 0010.

-- 1. Required tables.
select
  to_regclass('public.consistency_scans') as consistency_scans,
  to_regclass('public.consistency_findings') as consistency_findings,
  to_regclass('public.consistency_scan_findings') as consistency_scan_findings,
  to_regclass('public.consistency_finding_events') as consistency_finding_events;

-- 2. Required RPC functions.
select
  routine_name,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'record_consistency_scan',
    'review_consistency_finding'
  )
order by routine_name;

-- 3. RLS policies.
select
  tablename,
  policyname,
  roles,
  cmd
from pg_policies
where schemaname = 'public'
  and tablename in (
    'consistency_scans',
    'consistency_findings',
    'consistency_scan_findings',
    'consistency_finding_events'
  )
order by tablename, policyname;

-- 4. Scan count integrity. Must return zero rows.
select id, project_id, finding_count,
  critical_count + high_count + medium_count + low_count + info_count as severity_sum
from public.consistency_scans
where finding_count <>
  critical_count + high_count + medium_count + low_count + info_count;

-- 5. Project fingerprint uniqueness. Must return zero rows.
select project_id, fingerprint, count(*)
from public.consistency_findings
group by project_id, fingerprint
having count(*) > 1;

-- 6. AI run import uniqueness. Must return zero rows.
select source_run_id, count(*)
from public.consistency_scans
where source_run_id is not null
group by source_run_id
having count(*) > 1;

-- 7. Snapshot referential integrity. Must return zero rows.
select scan_findings.scan_id, scan_findings.finding_id
from public.consistency_scan_findings as scan_findings
left join public.consistency_scans as scans
  on scans.id = scan_findings.scan_id
left join public.consistency_findings as findings
  on findings.id = scan_findings.finding_id
where scans.id is null or findings.id is null;

-- 8. Operational summary by project.
select
  project_id,
  status,
  severity,
  count(*) as finding_count
from public.consistency_findings
group by project_id, status, severity
order by project_id, status, severity;

-- 9. Recent scan audit.
select
  id,
  project_id,
  source,
  source_run_id,
  project_model_version_number,
  finding_count,
  critical_count,
  high_count,
  created_by,
  created_at
from public.consistency_scans
order by created_at desc
limit 20;

-- 10. Recent finding lifecycle events.
select
  finding_id,
  project_id,
  event_type,
  status_from,
  status_to,
  actor_id,
  scan_id,
  created_at
from public.consistency_finding_events
order by created_at desc
limit 50;
