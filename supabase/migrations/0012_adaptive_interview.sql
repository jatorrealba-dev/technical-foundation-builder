create table if not exists public.interview_question_batches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  interview_session_id uuid not null references public.interview_sessions(id) on delete cascade,
  source text not null check (source in ('deterministic', 'agent')),
  source_run_id uuid references public.agent_runs(id) on delete set null,
  summary text not null default '',
  recommendation text not null default 'continue_interview'
    check (recommendation in ('continue_interview', 'ready_for_model', 'requires_human_review')),
  confidence numeric check (confidence is null or (confidence >= 0 and confidence <= 1)),
  missing_information jsonb not null default '[]'::jsonb
    check (jsonb_typeof(missing_information) = 'array'),
  contradictions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(contradictions) = 'array'),
  question_count integer not null default 0 check (question_count >= 0),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_interview_question_batches_source_run
on public.interview_question_batches(source_run_id)
where source_run_id is not null;

create index if not exists idx_interview_question_batches_project
on public.interview_question_batches(project_id, created_at desc);

create table if not exists public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  interview_session_id uuid not null references public.interview_sessions(id) on delete cascade,
  batch_id uuid references public.interview_question_batches(id) on delete set null,
  question_id text not null,
  stage text not null check (
    stage in (
      'idea', 'product', 'users', 'domain', 'workflow',
      'data', 'security', 'architecture', 'operations', 'delivery'
    )
  ),
  question text not null check (length(btrim(question)) > 0),
  helper_text text not null default '',
  reason text not null default '',
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  source text not null default 'base'
    check (source in ('base', 'deterministic', 'agent', 'manual')),
  source_run_id uuid references public.agent_runs(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'answered', 'skipped', 'deferred', 'obsolete')),
  sort_order integer not null default 100,
  fingerprint text not null,
  affects_artifacts jsonb not null default '[]'::jsonb
    check (jsonb_typeof(affects_artifacts) = 'array'),
  risk_area text,
  is_required boolean not null default false,
  reviewer_comment text,
  created_by uuid references auth.users(id) on delete set null,
  answered_at timestamptz,
  skipped_at timestamptz,
  deferred_at timestamptz,
  obsoleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (interview_session_id, question_id),
  unique (project_id, fingerprint)
);

create index if not exists idx_interview_questions_project_status
on public.interview_questions(project_id, status, sort_order);

create index if not exists idx_interview_questions_session
on public.interview_questions(interview_session_id, sort_order);

create table if not exists public.interview_question_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  question_id uuid not null references public.interview_questions(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'question_created', 'question_answered', 'question_updated',
      'question_skipped', 'question_deferred', 'question_reopened',
      'question_obsoleted'
    )
  ),
  previous_status text,
  next_status text,
  comment text,
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_interview_question_events_question
on public.interview_question_events(question_id, created_at desc);

alter table public.interview_question_batches enable row level security;
alter table public.interview_questions enable row level security;
alter table public.interview_question_events enable row level security;

drop policy if exists "Members can read interview question batches" on public.interview_question_batches;
create policy "Members can read interview question batches"
on public.interview_question_batches
for select
to authenticated
using (
  exists (
    select 1 from public.projects
    where projects.id = interview_question_batches.project_id
      and public.is_org_member(projects.organization_id)
  )
);

drop policy if exists "Members can read adaptive interview questions" on public.interview_questions;
create policy "Members can read adaptive interview questions"
on public.interview_questions
for select
to authenticated
using (
  exists (
    select 1 from public.projects
    where projects.id = interview_questions.project_id
      and public.is_org_member(projects.organization_id)
  )
);

drop policy if exists "Members can read interview question events" on public.interview_question_events;
create policy "Members can read interview question events"
on public.interview_question_events
for select
to authenticated
using (
  exists (
    select 1 from public.projects
    where projects.id = interview_question_events.project_id
      and public.is_org_member(projects.organization_id)
  )
);

revoke insert, update, delete on public.interview_question_batches from authenticated;
revoke insert, update, delete on public.interview_questions from authenticated;
revoke insert, update, delete on public.interview_question_events from authenticated;

create or replace function public.ensure_adaptive_interview(target_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_organization_id uuid;
  selected_session public.interview_sessions%rowtype;
  base_question jsonb;
  inserted_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  select organization_id into target_organization_id
  from public.projects
  where id = target_project_id;

  if target_organization_id is null
    or not public.is_org_member(target_organization_id)
  then
    return jsonb_build_object(
      'ok', false,
      'code', 'project_not_found',
      'error', 'El proyecto no existe o no tienes acceso.'
    );
  end if;

  insert into public.interview_sessions (
    project_id, status, current_stage, created_at, updated_at
  ) values (
    target_project_id, 'not_started', 'idea', now(), now()
  )
  on conflict (project_id) do update
    set updated_at = public.interview_sessions.updated_at
  returning * into selected_session;

  for base_question in
    select value from jsonb_array_elements(
      '[
        {"id":"idea-001","stage":"idea","question":"¿Qué quieres construir exactamente?","helperText":"Descríbelo como si se lo explicaras a un desarrollador que no conoce tu idea.","reason":"Define la intención del producto y reduce ambigüedad antes de modelar requisitos.","priority":"high","sortOrder":10,"affectsArtifacts":["product_spec","mvp_scope"],"riskArea":"product_definition","required":true},
        {"id":"product-001","stage":"product","question":"¿Qué problema principal resuelve este producto?","helperText":"Evita describir solo funcionalidades. Explica el dolor o necesidad real.","reason":"Permite diferenciar capacidades deseadas de valor real para el usuario.","priority":"high","sortOrder":20,"affectsArtifacts":["product_spec","mvp_scope","backlog"],"riskArea":"product_value","required":true},
        {"id":"users-001","stage":"users","question":"¿Quiénes serán los usuarios principales?","helperText":"Incluye usuarios finales, administradores, operadores, clientes o equipos internos.","reason":"Los actores y sus responsabilidades determinan permisos, workflows y criterios de aceptación.","priority":"high","sortOrder":30,"affectsArtifacts":["product_spec","domain_model","security"],"riskArea":"identity_and_access","required":true},
        {"id":"domain-001","stage":"domain","question":"¿Cuáles son las entidades principales del negocio?","helperText":"Ejemplo: usuario, proyecto, ticket, empleado, pago, locación, documento, etc.","reason":"Establece el vocabulario inicial y los límites del dominio.","priority":"high","sortOrder":40,"affectsArtifacts":["domain_model","data_model","architecture"],"riskArea":"domain_modeling","required":true},
        {"id":"security-001","stage":"security","question":"¿Qué información debe protegerse especialmente?","helperText":"Piensa en datos privados, información financiera, documentos sensibles, credenciales o permisos.","reason":"La clasificación temprana de datos evita decisiones inseguras de arquitectura y acceso.","priority":"high","sortOrder":50,"affectsArtifacts":["security","data_model","architecture"],"riskArea":"data_protection","required":true},
        {"id":"architecture-001","stage":"architecture","question":"¿El sistema debe ser web, móvil, interno, SaaS o una combinación?","helperText":"También indica si debe funcionar para varias empresas, equipos o clientes.","reason":"Aclara canales, tenancy, distribución y restricciones de plataforma.","priority":"medium","sortOrder":60,"affectsArtifacts":["architecture","security","data_model"],"riskArea":"solution_shape","required":true},
        {"id":"delivery-001","stage":"delivery","question":"¿Cuál sería la primera versión útil del producto?","helperText":"Describe el MVP: lo mínimo que debe existir para que el producto ya entregue valor.","reason":"Define un corte de entrega verificable y reduce el riesgo de alcance abierto.","priority":"high","sortOrder":70,"affectsArtifacts":["mvp_scope","backlog","vertical_slice_plan"],"riskArea":"delivery_scope","required":true}
      ]'::jsonb
    )
  loop
    insert into public.interview_questions (
      project_id,
      interview_session_id,
      question_id,
      stage,
      question,
      helper_text,
      reason,
      priority,
      source,
      status,
      sort_order,
      fingerprint,
      affects_artifacts,
      risk_area,
      is_required,
      created_by,
      created_at,
      updated_at
    ) values (
      target_project_id,
      selected_session.id,
      base_question->>'id',
      base_question->>'stage',
      base_question->>'question',
      base_question->>'helperText',
      base_question->>'reason',
      base_question->>'priority',
      'base',
      case
        when exists (
          select 1 from public.interview_answers
          where interview_session_id = selected_session.id
            and question_id = base_question->>'id'
        ) then 'answered'
        else 'pending'
      end,
      (base_question->>'sortOrder')::integer,
      (base_question->>'stage') || ':' || lower(regexp_replace(base_question->>'question', '[^[:alnum:]]+', ' ', 'g')),
      base_question->'affectsArtifacts',
      base_question->>'riskArea',
      (base_question->>'required')::boolean,
      auth.uid(),
      now(),
      now()
    )
    on conflict (interview_session_id, question_id) do nothing;

    if found then
      inserted_count := inserted_count + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'sessionId', selected_session.id,
    'insertedCount', inserted_count
  );
end;
$$;

create or replace function public.record_interview_question_batch(
  target_project_id uuid,
  target_source text,
  target_source_run_id uuid,
  target_summary text,
  target_recommendation text,
  target_confidence numeric,
  target_missing_information jsonb,
  target_contradictions jsonb,
  target_questions jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_organization_id uuid;
  selected_session public.interview_sessions%rowtype;
  selected_run public.agent_runs%rowtype;
  selected_review public.agent_run_reviews%rowtype;
  existing_batch_id uuid;
  new_batch_id uuid;
  question_item jsonb;
  proposed_fingerprint text;
  proposed_question_id text;
  inserted_count integer := 0;
  skipped_count integer := 0;
  max_sort_order integer := 100;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if target_source not in ('deterministic', 'agent') then
    return jsonb_build_object('ok', false, 'code', 'invalid_source', 'error', 'La fuente no es válida.');
  end if;

  if target_recommendation not in ('continue_interview', 'ready_for_model', 'requires_human_review') then
    return jsonb_build_object('ok', false, 'code', 'invalid_recommendation', 'error', 'La recomendación no es válida.');
  end if;

  if jsonb_typeof(target_questions) <> 'array'
    or jsonb_typeof(target_missing_information) <> 'array'
    or jsonb_typeof(target_contradictions) <> 'array'
  then
    return jsonb_build_object('ok', false, 'code', 'invalid_payload', 'error', 'La estructura del lote no es válida.');
  end if;

  select organization_id into target_organization_id
  from public.projects
  where id = target_project_id;

  if target_organization_id is null
    or not public.is_org_member(target_organization_id)
  then
    return jsonb_build_object('ok', false, 'code', 'project_not_found', 'error', 'El proyecto no existe o no tienes acceso.');
  end if;

  perform public.ensure_adaptive_interview(target_project_id);

  select * into selected_session
  from public.interview_sessions
  where project_id = target_project_id;

  if target_source = 'deterministic' and target_source_run_id is not null then
    return jsonb_build_object('ok', false, 'code', 'invalid_run', 'error', 'Un lote determinista no puede tener una ejecución de IA.');
  end if;

  if target_source = 'agent' then
    if target_source_run_id is null then
      return jsonb_build_object('ok', false, 'code', 'run_required', 'error', 'La ejecución de Interview Strategist es obligatoria.');
    end if;

    select * into selected_run
    from public.agent_runs
    where id = target_source_run_id
      and project_id = target_project_id;

    if selected_run.id is null
      or selected_run.agent_key <> 'interview'
      or selected_run.status <> 'completed'
      or selected_run.output is null
    then
      return jsonb_build_object('ok', false, 'code', 'invalid_run', 'error', 'La ejecución no es un Interview Strategist completado.');
    end if;

    select * into selected_review
    from public.agent_run_reviews
    where run_id = target_source_run_id
      and project_id = target_project_id;

    if selected_review.id is null or selected_review.decision <> 'approved' then
      return jsonb_build_object('ok', false, 'code', 'review_not_approved', 'error', 'La ejecución debe estar aprobada antes de importar preguntas.');
    end if;

    select id into existing_batch_id
    from public.interview_question_batches
    where source_run_id = target_source_run_id;

    if existing_batch_id is not null then
      return jsonb_build_object('ok', true, 'batchId', existing_batch_id, 'existing', true, 'insertedCount', 0, 'skippedCount', 0);
    end if;
  end if;

  select coalesce(max(sort_order), 100)
  into max_sort_order
  from public.interview_questions
  where project_id = target_project_id;

  insert into public.interview_question_batches (
    project_id,
    interview_session_id,
    source,
    source_run_id,
    summary,
    recommendation,
    confidence,
    missing_information,
    contradictions,
    question_count,
    created_by
  ) values (
    target_project_id,
    selected_session.id,
    target_source,
    target_source_run_id,
    coalesce(target_summary, ''),
    target_recommendation,
    target_confidence,
    target_missing_information,
    target_contradictions,
    jsonb_array_length(target_questions),
    auth.uid()
  ) returning id into new_batch_id;

  for question_item in
    select value from jsonb_array_elements(target_questions)
  loop
    if coalesce(question_item->>'question', '') = ''
      or question_item->>'stage' not in (
        'idea', 'product', 'users', 'domain', 'workflow',
        'data', 'security', 'architecture', 'operations', 'delivery'
      )
      or question_item->>'priority' not in ('low', 'medium', 'high')
      or jsonb_typeof(question_item->'affectsArtifacts') <> 'array'
    then
      raise exception 'Invalid adaptive interview question payload.';
    end if;

    proposed_fingerprint := coalesce(
      nullif(question_item->>'fingerprint', ''),
      (question_item->>'stage') || ':' || lower(regexp_replace(question_item->>'question', '[^[:alnum:]]+', ' ', 'g'))
    );

    proposed_question_id := 'adaptive-' || substr(md5(proposed_fingerprint), 1, 16);

    insert into public.interview_questions (
      project_id,
      interview_session_id,
      batch_id,
      question_id,
      stage,
      question,
      helper_text,
      reason,
      priority,
      source,
      source_run_id,
      status,
      sort_order,
      fingerprint,
      affects_artifacts,
      risk_area,
      is_required,
      created_by
    ) values (
      target_project_id,
      selected_session.id,
      new_batch_id,
      proposed_question_id,
      question_item->>'stage',
      question_item->>'question',
      coalesce(question_item->>'helperText', ''),
      coalesce(question_item->>'reason', ''),
      question_item->>'priority',
      target_source,
      target_source_run_id,
      'pending',
      max_sort_order + ((inserted_count + skipped_count + 1) * 10),
      proposed_fingerprint,
      question_item->'affectsArtifacts',
      nullif(question_item->>'riskArea', ''),
      coalesce((question_item->>'required')::boolean, false),
      auth.uid()
    )
    on conflict (project_id, fingerprint) do nothing
    returning id into existing_batch_id;

    if existing_batch_id is null then
      skipped_count := skipped_count + 1;
    else
      inserted_count := inserted_count + 1;
      insert into public.interview_question_events (
        project_id, question_id, event_type, next_status, payload, created_by
      ) values (
        target_project_id,
        existing_batch_id,
        'question_created',
        'pending',
        jsonb_build_object('source', target_source, 'batchId', new_batch_id),
        auth.uid()
      );
    end if;

    existing_batch_id := null;
  end loop;

  update public.interview_question_batches
  set question_count = inserted_count
  where id = new_batch_id;

  if inserted_count > 0 then
    update public.interview_sessions
    set status = 'in_progress', updated_at = now()
    where id = selected_session.id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'batchId', new_batch_id,
    'existing', false,
    'insertedCount', inserted_count,
    'skippedCount', skipped_count
  );
end;
$$;

create or replace function public.save_adaptive_interview_answer(
  target_project_id uuid,
  target_question_id text,
  target_answer text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_organization_id uuid;
  selected_session public.interview_sessions%rowtype;
  selected_question public.interview_questions%rowtype;
  next_question public.interview_questions%rowtype;
  remaining_required integer;
  answered_count integer;
  active_count integer;
  completion integer;
  next_session_status text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if btrim(coalesce(target_answer, '')) = '' then
    return jsonb_build_object('ok', false, 'code', 'empty_answer', 'error', 'La respuesta no puede estar vacía.');
  end if;

  select organization_id into target_organization_id
  from public.projects
  where id = target_project_id;

  if target_organization_id is null
    or not public.is_org_member(target_organization_id)
  then
    return jsonb_build_object('ok', false, 'code', 'project_not_found', 'error', 'El proyecto no existe o no tienes acceso.');
  end if;

  perform public.ensure_adaptive_interview(target_project_id);

  select * into selected_session
  from public.interview_sessions
  where project_id = target_project_id;

  select * into selected_question
  from public.interview_questions
  where project_id = target_project_id
    and interview_session_id = selected_session.id
    and question_id = target_question_id
  for update;

  if selected_question.id is null then
    return jsonb_build_object('ok', false, 'code', 'question_not_found', 'error', 'La pregunta no existe o no tienes acceso.');
  end if;

  if selected_question.status = 'obsolete' then
    return jsonb_build_object('ok', false, 'code', 'obsolete_question', 'error', 'La pregunta está obsoleta y no puede responderse.');
  end if;

  insert into public.interview_answers (
    interview_session_id, question_id, stage, answer, answered_at
  ) values (
    selected_session.id,
    selected_question.question_id,
    selected_question.stage,
    btrim(target_answer),
    now()
  )
  on conflict (interview_session_id, question_id) do update
    set stage = excluded.stage,
        answer = excluded.answer,
        answered_at = excluded.answered_at;

  update public.interview_questions
  set status = 'answered',
      answered_at = now(),
      skipped_at = null,
      deferred_at = null,
      reviewer_comment = null,
      updated_at = now()
  where id = selected_question.id;

  insert into public.interview_question_events (
    project_id, question_id, event_type, previous_status, next_status, created_by
  ) values (
    target_project_id,
    selected_question.id,
    case when selected_question.status = 'answered' then 'question_updated' else 'question_answered' end,
    selected_question.status,
    'answered',
    auth.uid()
  );

  select count(*) into remaining_required
  from public.interview_questions
  where project_id = target_project_id
    and is_required
    and status in ('pending', 'deferred');

  select count(*) filter (where status = 'answered'),
         count(*) filter (where status <> 'obsolete')
  into answered_count, active_count
  from public.interview_questions
  where project_id = target_project_id;

  completion := case
    when active_count = 0 then 0
    else least(100, round((answered_count::numeric / active_count::numeric) * 100))::integer
  end;

  select * into next_question
  from public.interview_questions
  where project_id = target_project_id
    and status in ('pending', 'deferred')
  order by
    case priority when 'high' then 1 when 'medium' then 2 else 3 end,
    sort_order,
    created_at
  limit 1;

  next_session_status := case when remaining_required = 0 then 'completed' else 'in_progress' end;

  update public.interview_sessions
  set status = next_session_status,
      current_stage = coalesce(next_question.stage, selected_question.stage),
      updated_at = now()
  where id = selected_session.id;

  return jsonb_build_object(
    'ok', true,
    'status', next_session_status,
    'completion', completion,
    'nextQuestionId', next_question.question_id
  );
end;
$$;

create or replace function public.set_interview_question_status(
  target_project_id uuid,
  target_question_id text,
  target_status text,
  target_comment text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_organization_id uuid;
  selected_question public.interview_questions%rowtype;
  selected_session public.interview_sessions%rowtype;
  next_question public.interview_questions%rowtype;
  remaining_required integer;
  next_session_status text;
  event_name text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if target_status not in ('pending', 'skipped', 'deferred', 'obsolete') then
    return jsonb_build_object('ok', false, 'code', 'invalid_status', 'error', 'El estado solicitado no es válido.');
  end if;

  select organization_id into target_organization_id
  from public.projects
  where id = target_project_id;

  if target_organization_id is null
    or not public.is_org_member(target_organization_id)
  then
    return jsonb_build_object('ok', false, 'code', 'project_not_found', 'error', 'El proyecto no existe o no tienes acceso.');
  end if;

  select * into selected_question
  from public.interview_questions
  where project_id = target_project_id
    and question_id = target_question_id
  for update;

  if selected_question.id is null then
    return jsonb_build_object('ok', false, 'code', 'question_not_found', 'error', 'La pregunta no existe.');
  end if;

  if selected_question.status = 'answered' then
    return jsonb_build_object('ok', false, 'code', 'answered_question', 'error', 'Una pregunta respondida no puede cambiarse a este estado sin editar su respuesta.');
  end if;

  if target_status = 'obsolete' and not public.is_org_admin(target_organization_id) then
    return jsonb_build_object('ok', false, 'code', 'forbidden', 'error', 'Solo owner o admin puede marcar una pregunta como obsoleta.');
  end if;

  event_name := case target_status
    when 'skipped' then 'question_skipped'
    when 'deferred' then 'question_deferred'
    when 'obsolete' then 'question_obsoleted'
    else 'question_reopened'
  end;

  update public.interview_questions
  set status = target_status,
      reviewer_comment = nullif(btrim(coalesce(target_comment, '')), ''),
      skipped_at = case when target_status = 'skipped' then now() else null end,
      deferred_at = case when target_status = 'deferred' then now() else null end,
      obsoleted_at = case when target_status = 'obsolete' then now() else null end,
      updated_at = now()
  where id = selected_question.id;

  insert into public.interview_question_events (
    project_id, question_id, event_type, previous_status, next_status, comment, created_by
  ) values (
    target_project_id,
    selected_question.id,
    event_name,
    selected_question.status,
    target_status,
    nullif(btrim(coalesce(target_comment, '')), ''),
    auth.uid()
  );

  select * into selected_session
  from public.interview_sessions
  where id = selected_question.interview_session_id;

  select count(*) into remaining_required
  from public.interview_questions
  where project_id = target_project_id
    and is_required
    and status in ('pending', 'deferred');

  select * into next_question
  from public.interview_questions
  where project_id = target_project_id
    and status in ('pending', 'deferred')
  order by
    case priority when 'high' then 1 when 'medium' then 2 else 3 end,
    sort_order,
    created_at
  limit 1;

  next_session_status := case
    when remaining_required = 0 then 'completed'
    when exists (
      select 1 from public.interview_questions
      where project_id = target_project_id and status = 'answered'
    ) then 'in_progress'
    else 'not_started'
  end;

  update public.interview_sessions
  set status = next_session_status,
      current_stage = coalesce(next_question.stage, selected_session.current_stage),
      updated_at = now()
  where id = selected_session.id;

  return jsonb_build_object(
    'ok', true,
    'status', target_status,
    'sessionStatus', next_session_status,
    'nextQuestionId', next_question.question_id
  );
end;
$$;

revoke all on function public.ensure_adaptive_interview(uuid) from public;
revoke all on function public.record_interview_question_batch(uuid, text, uuid, text, text, numeric, jsonb, jsonb, jsonb) from public;
revoke all on function public.save_adaptive_interview_answer(uuid, text, text) from public;
revoke all on function public.set_interview_question_status(uuid, text, text, text) from public;

grant execute on function public.ensure_adaptive_interview(uuid) to authenticated;
grant execute on function public.record_interview_question_batch(uuid, text, uuid, text, text, numeric, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.save_adaptive_interview_answer(uuid, text, text) to authenticated;
grant execute on function public.set_interview_question_status(uuid, text, text, text) to authenticated;

-- Backfill existing sessions and preserve already answered base questions.
do $$
declare
  project_record record;
begin
  for project_record in
    select distinct project_id from public.interview_sessions
  loop
    -- The helper requires auth.uid(), so the data-only backfill is repeated inline.
    insert into public.interview_questions (
      project_id, interview_session_id, question_id, stage, question,
      helper_text, reason, priority, source, status, sort_order,
      fingerprint, affects_artifacts, risk_area, is_required, created_at, updated_at
    )
    select
      project_record.project_id,
      session.id,
      item->>'id',
      item->>'stage',
      item->>'question',
      item->>'helperText',
      item->>'reason',
      item->>'priority',
      'base',
      case when answer.id is null then 'pending' else 'answered' end,
      (item->>'sortOrder')::integer,
      (item->>'stage') || ':' || lower(regexp_replace(item->>'question', '[^[:alnum:]]+', ' ', 'g')),
      item->'affectsArtifacts',
      item->>'riskArea',
      (item->>'required')::boolean,
      now(),
      now()
    from public.interview_sessions session
    cross join jsonb_array_elements(
      '[
        {"id":"idea-001","stage":"idea","question":"¿Qué quieres construir exactamente?","helperText":"Descríbelo como si se lo explicaras a un desarrollador que no conoce tu idea.","reason":"Define la intención del producto y reduce ambigüedad antes de modelar requisitos.","priority":"high","sortOrder":10,"affectsArtifacts":["product_spec","mvp_scope"],"riskArea":"product_definition","required":true},
        {"id":"product-001","stage":"product","question":"¿Qué problema principal resuelve este producto?","helperText":"Evita describir solo funcionalidades. Explica el dolor o necesidad real.","reason":"Permite diferenciar capacidades deseadas de valor real para el usuario.","priority":"high","sortOrder":20,"affectsArtifacts":["product_spec","mvp_scope","backlog"],"riskArea":"product_value","required":true},
        {"id":"users-001","stage":"users","question":"¿Quiénes serán los usuarios principales?","helperText":"Incluye usuarios finales, administradores, operadores, clientes o equipos internos.","reason":"Los actores y sus responsabilidades determinan permisos, workflows y criterios de aceptación.","priority":"high","sortOrder":30,"affectsArtifacts":["product_spec","domain_model","security"],"riskArea":"identity_and_access","required":true},
        {"id":"domain-001","stage":"domain","question":"¿Cuáles son las entidades principales del negocio?","helperText":"Ejemplo: usuario, proyecto, ticket, empleado, pago, locación, documento, etc.","reason":"Establece el vocabulario inicial y los límites del dominio.","priority":"high","sortOrder":40,"affectsArtifacts":["domain_model","data_model","architecture"],"riskArea":"domain_modeling","required":true},
        {"id":"security-001","stage":"security","question":"¿Qué información debe protegerse especialmente?","helperText":"Piensa en datos privados, información financiera, documentos sensibles, credenciales o permisos.","reason":"La clasificación temprana de datos evita decisiones inseguras de arquitectura y acceso.","priority":"high","sortOrder":50,"affectsArtifacts":["security","data_model","architecture"],"riskArea":"data_protection","required":true},
        {"id":"architecture-001","stage":"architecture","question":"¿El sistema debe ser web, móvil, interno, SaaS o una combinación?","helperText":"También indica si debe funcionar para varias empresas, equipos o clientes.","reason":"Aclara canales, tenancy, distribución y restricciones de plataforma.","priority":"medium","sortOrder":60,"affectsArtifacts":["architecture","security","data_model"],"riskArea":"solution_shape","required":true},
        {"id":"delivery-001","stage":"delivery","question":"¿Cuál sería la primera versión útil del producto?","helperText":"Describe el MVP: lo mínimo que debe existir para que el producto ya entregue valor.","reason":"Define un corte de entrega verificable y reduce el riesgo de alcance abierto.","priority":"high","sortOrder":70,"affectsArtifacts":["mvp_scope","backlog","vertical_slice_plan"],"riskArea":"delivery_scope","required":true}
      ]'::jsonb
    ) item
    left join public.interview_answers answer
      on answer.interview_session_id = session.id
      and answer.question_id = item->>'id'
    where session.project_id = project_record.project_id
    on conflict (interview_session_id, question_id) do nothing;
  end loop;
end;
$$;
