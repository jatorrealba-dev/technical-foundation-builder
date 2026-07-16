-- Ejecutar en Supabase SQL Editor después de aplicar 0012.
-- Sustituye <PROJECT_ID> y, cuando corresponda, <RUN_ID>.

select
  project_id,
  status,
  current_stage,
  created_at,
  updated_at
from public.interview_sessions
where project_id = '<PROJECT_ID>'::uuid;

select
  question_id,
  stage,
  source,
  priority,
  status,
  is_required,
  risk_area,
  affects_artifacts,
  reviewer_comment,
  created_at,
  updated_at
from public.interview_questions
where project_id = '<PROJECT_ID>'::uuid
order by sort_order, created_at;

select
  source,
  source_run_id,
  recommendation,
  confidence,
  question_count,
  missing_information,
  contradictions,
  created_at
from public.interview_question_batches
where project_id = '<PROJECT_ID>'::uuid
order by created_at desc;

select
  event_type,
  previous_status,
  next_status,
  comment,
  payload,
  created_at
from public.interview_question_events
where project_id = '<PROJECT_ID>'::uuid
order by created_at desc;

-- No debe devolver fingerprints duplicados.
select fingerprint, count(*)
from public.interview_questions
where project_id = '<PROJECT_ID>'::uuid
group by fingerprint
having count(*) > 1;

-- Una ejecución aprobada de Interview Strategist debe tener como máximo un lote.
select source_run_id, count(*)
from public.interview_question_batches
where source_run_id is not null
group by source_run_id
having count(*) > 1;
