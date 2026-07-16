-- Readiness Dashboard v7 read-only verification queries.
-- Execute in Supabase SQL Editor after migration 0011.

-- 1. Required tables.
select
  to_regclass('public.readiness_assessments') as readiness_assessments,
  to_regclass('public.readiness_dimension_scores') as readiness_dimension_scores,
  to_regclass('public.readiness_blockers') as readiness_blockers,
  to_regclass('public.readiness_actions') as readiness_actions,
  to_regclass('public.readiness_review_events') as readiness_review_events;

-- 2. Required RPC functions.
select
  routine_name,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'record_readiness_assessment',
    'review_readiness_blocker',
    'review_readiness_action'
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
    'readiness_assessments',
    'readiness_dimension_scores',
    'readiness_blockers',
    'readiness_actions',
    'readiness_review_events'
  )
order by tablename, policyname;

-- 4. Every assessment must contain exactly eight dimensions.
-- Must return zero rows.
select
  assessments.id,
  count(scores.dimension_key) as dimension_count,
  count(distinct scores.dimension_key) as distinct_dimension_count
from public.readiness_assessments as assessments
left join public.readiness_dimension_scores as scores
  on scores.assessment_id = assessments.id
group by assessments.id
having count(scores.dimension_key) <> 8
  or count(distinct scores.dimension_key) <> 8;

-- 5. Blocker count integrity. Must return zero rows.
select
  id,
  blocker_count,
  critical_blocker_count + high_blocker_count +
    medium_blocker_count + low_blocker_count as priority_sum
from public.readiness_assessments
where blocker_count <>
  critical_blocker_count + high_blocker_count +
  medium_blocker_count + low_blocker_count;

-- 6. AI run import uniqueness. Must return zero rows.
select source_run_id, count(*)
from public.readiness_assessments
where source_run_id is not null
group by source_run_id
having count(*) > 1;

-- 7. Project ownership consistency. Must return zero rows.
select blockers.id
from public.readiness_blockers as blockers
join public.readiness_assessments as assessments
  on assessments.id = blockers.assessment_id
where blockers.project_id <> assessments.project_id;

select actions.id
from public.readiness_actions as actions
join public.readiness_assessments as assessments
  on assessments.id = actions.assessment_id
where actions.project_id <> assessments.project_id;

-- 8. Recent readiness trend.
select
  project_id,
  source,
  project_model_version_number,
  overall_score,
  level,
  blocker_count,
  critical_blocker_count,
  high_blocker_count,
  created_at
from public.readiness_assessments
order by created_at desc
limit 30;

-- 9. Latest open blockers and active actions.
select
  project_id,
  dimension_key,
  priority,
  status,
  title,
  created_at
from public.readiness_blockers
where status in ('open', 'accepted')
order by created_at desc
limit 50;

select
  project_id,
  dimension_key,
  priority,
  status,
  action,
  owner_role,
  created_at
from public.readiness_actions
where status in ('pending', 'in_progress')
order by created_at desc
limit 50;

-- 10. Recent review audit.
select
  project_id,
  assessment_id,
  item_type,
  item_id,
  status_from,
  status_to,
  actor_id,
  created_at
from public.readiness_review_events
order by created_at desc
limit 50;
