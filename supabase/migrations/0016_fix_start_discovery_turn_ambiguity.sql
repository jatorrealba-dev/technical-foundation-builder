begin;

create or replace function public.start_discovery_turn(
  target_project_id uuid,
  target_content text,
  target_client_message_id uuid
)
returns table (
  session_id uuid,
  turn_id uuid,
  user_message_id uuid,
  sequence_number integer,
  turn_count integer,
  turn_mode text,
  should_process boolean,
  idempotent boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session public.discovery_sessions%rowtype;
  existing_message public.discovery_messages%rowtype;
  assistant_exists boolean;
  next_turn_id uuid;
  next_sequence integer;
  next_turn_count integer;
  next_turn_mode text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if target_client_message_id is null then
    raise exception 'discovery_client_message_id_required';
  end if;

  if target_content is null or char_length(trim(target_content)) not between 1 and 20000 then
    raise exception 'discovery_invalid_message';
  end if;

  select *
  into target_session
  from public.ensure_discovery_session(target_project_id);

  select *
  into target_session
  from public.discovery_sessions
  where id = target_session.id
  for update;

  select *
  into existing_message
  from public.discovery_messages as messages
  where messages.session_id = target_session.id
    and messages.client_message_id = target_client_message_id;

  if existing_message.id is not null then
    if existing_message.content <> trim(target_content) then
      raise exception 'discovery_duplicate_message_mismatch';
    end if;

    select exists (
      select 1
      from public.discovery_messages as messages
      where messages.session_id = target_session.id
        and messages.turn_id = existing_message.turn_id
        and messages.role = 'assistant'
    ) into assistant_exists;

    if assistant_exists or target_session.active_turn_id = existing_message.turn_id then
      return query
      select
        target_session.id,
        existing_message.turn_id,
        existing_message.id,
        existing_message.sequence_number,
        target_session.turn_count,
        case
          when target_session.turn_count >= target_session.hard_turn_limit then 'human_review_required'
          when target_session.turn_count >= target_session.soft_turn_limit then 'blockers_only'
          else 'normal'
        end,
        false,
        true;
      return;
    end if;

    if target_session.active_turn_id is not null then
      raise exception 'discovery_turn_in_progress';
    end if;

    if target_session.turn_count >= target_session.hard_turn_limit then
      return query
      select
        target_session.id,
        existing_message.turn_id,
        existing_message.id,
        existing_message.sequence_number,
        target_session.turn_count,
        'human_review_required',
        false,
        true;
      return;
    end if;

    update public.discovery_sessions
    set
      status = 'in_progress',
      active_turn_id = existing_message.turn_id,
      active_turn_started_at = now(),
      active_turn_user_message_id = existing_message.id,
      lock_version = lock_version + 1,
      started_at = coalesce(started_at, now()),
      started_by = coalesce(started_by, auth.uid()),
      updated_at = now()
    where id = target_session.id
    returning * into target_session;

    perform public.discovery_v2_append_event(
      target_session.id,
      'turn.retried',
      auth.uid(),
      null,
      null,
      jsonb_build_object(
        'turnId', existing_message.turn_id,
        'userMessageId', existing_message.id
      )
    );

    return query
    select
      target_session.id,
      existing_message.turn_id,
      existing_message.id,
      existing_message.sequence_number,
      target_session.turn_count,
      case
        when target_session.turn_count >= target_session.hard_turn_limit then 'human_review_required'
        when target_session.turn_count >= target_session.soft_turn_limit then 'blockers_only'
        else 'normal'
      end,
      true,
      true;
    return;
  end if;

  if target_session.status in ('completed', 'completed_with_open_items', 'abandoned') then
    raise exception 'discovery_session_completed';
  end if;

  if target_session.active_turn_id is not null then
    if target_session.active_turn_started_at < now() - interval '15 minutes' then
      perform public.discovery_v2_append_event(
        target_session.id,
        'turn.recovered',
        auth.uid(),
        null,
        null,
        jsonb_build_object(
          'turnId', target_session.active_turn_id,
          'reason', 'stale_turn_recovered'
        )
      );

      update public.discovery_sessions
      set
        active_turn_id = null,
        active_turn_started_at = null,
        active_turn_user_message_id = null,
        lock_version = lock_version + 1,
        updated_at = now()
      where id = target_session.id
      returning * into target_session;
    else
      raise exception 'discovery_turn_in_progress';
    end if;
  end if;

  if target_session.turn_count >= target_session.hard_turn_limit then
    raise exception 'discovery_hard_turn_limit_reached';
  end if;

  next_turn_id := gen_random_uuid();
  next_turn_count := target_session.turn_count + 1;

  select coalesce(max(messages.sequence_number), 0) + 1
  into next_sequence
  from public.discovery_messages as messages
  where messages.session_id = target_session.id;

  insert into public.discovery_messages (
    session_id,
    organization_id,
    project_id,
    turn_id,
    role,
    content,
    sequence_number,
    client_message_id,
    created_by
  )
  values (
    target_session.id,
    target_session.organization_id,
    target_session.project_id,
    next_turn_id,
    'user',
    trim(target_content),
    next_sequence,
    target_client_message_id,
    auth.uid()
  )
  returning id into user_message_id;

  next_turn_mode := case
    when next_turn_count >= target_session.hard_turn_limit then 'human_review_required'
    when next_turn_count >= target_session.soft_turn_limit then 'blockers_only'
    else 'normal'
  end;

  update public.discovery_sessions
  set
    status = 'in_progress',
    turn_count = next_turn_count,
    active_turn_id = case
      when next_turn_mode = 'human_review_required' then null
      else next_turn_id
    end,
    active_turn_started_at = case
      when next_turn_mode = 'human_review_required' then null
      else now()
    end,
    active_turn_user_message_id = case
      when next_turn_mode = 'human_review_required' then null
      else user_message_id
    end,
    lock_version = lock_version + 1,
    started_at = coalesce(started_at, now()),
    started_by = coalesce(started_by, auth.uid()),
    updated_at = now()
  where id = target_session.id
  returning * into target_session;

  perform public.discovery_v2_append_event(
    target_session.id,
    'turn.started',
    auth.uid(),
    null,
    null,
    jsonb_build_object(
      'turnId', next_turn_id,
      'userMessageId', user_message_id,
      'turnCount', next_turn_count,
      'turnMode', next_turn_mode
    )
  );

  perform public.discovery_v2_append_event(
    target_session.id,
    'message.user_recorded',
    auth.uid(),
    null,
    null,
    jsonb_build_object(
      'turnId', next_turn_id,
      'messageId', user_message_id,
      'sequenceNumber', next_sequence
    )
  );

  if next_turn_mode = 'human_review_required' then
    perform public.discovery_v2_append_event(
      target_session.id,
      'turn.human_review_required',
      auth.uid(),
      null,
      null,
      jsonb_build_object(
        'turnId', next_turn_id,
        'userMessageId', user_message_id,
        'turnCount', next_turn_count
      )
    );
  end if;

  return query
  select
    target_session.id,
    next_turn_id,
    user_message_id,
    next_sequence,
    next_turn_count,
    next_turn_mode,
    next_turn_mode <> 'human_review_required',
    false;
end;
$$;

revoke all privileges on function public.start_discovery_turn(uuid, text, uuid)
from public, anon;

grant execute on function public.start_discovery_turn(uuid, text, uuid)
to authenticated;

commit;
