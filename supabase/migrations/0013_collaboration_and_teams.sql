create extension if not exists "pgcrypto";

alter table public.organization_members
add column if not exists email text;

alter table public.organization_members
add column if not exists invited_by uuid references auth.users(id) on delete set null;

alter table public.organization_members
add column if not exists updated_at timestamptz not null default now();

update public.organization_members as memberships
set email = lower(users.email)
from auth.users as users
where users.id = memberships.user_id
  and memberships.email is null;

create unique index if not exists idx_organization_members_organization_email
on public.organization_members (
  organization_id,
  lower(email)
)
where email is not null;

create index if not exists idx_organization_members_role
on public.organization_members (
  organization_id,
  role
);

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'member')),
  token_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (email = lower(trim(email))),
  check (expires_at > created_at),
  check (
    (status = 'accepted' and accepted_at is not null and accepted_by is not null)
    or status <> 'accepted'
  ),
  check (
    (status = 'revoked' and revoked_at is not null)
    or status <> 'revoked'
  )
);

create unique index if not exists idx_organization_invitations_pending_email
on public.organization_invitations (
  organization_id,
  lower(email)
)
where status = 'pending';

create index if not exists idx_organization_invitations_org_status
on public.organization_invitations (
  organization_id,
  status,
  created_at desc
);

create index if not exists idx_organization_invitations_expires_at
on public.organization_invitations (
  expires_at
)
where status = 'pending';

create table if not exists public.organization_membership_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  membership_id uuid references public.organization_members(id) on delete set null,
  invitation_id uuid references public.organization_invitations(id) on delete set null,
  event_type text not null check (
    event_type in (
      'invitation_created',
      'invitation_revoked',
      'invitation_expired',
      'invitation_accepted',
      'member_added',
      'member_role_changed',
      'member_removed',
      'member_left',
      'ownership_transferred'
    )
  ),
  actor_user_id uuid references auth.users(id) on delete set null,
  subject_user_id uuid references auth.users(id) on delete set null,
  subject_email text,
  from_role text,
  to_role text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_organization_membership_events_org_created
on public.organization_membership_events (
  organization_id,
  created_at desc
);

create or replace function public.normalize_email(target_email text)
returns text
language sql
immutable
strict
as $$
  select lower(trim(target_email));
$$;


create or replace function public.populate_organization_member_email()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.email is null or trim(new.email) = '' then
    select lower(email)
    into new.email
    from auth.users
    where id = new.user_id;
  else
    new.email := public.normalize_email(new.email);
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists populate_organization_member_email
on public.organization_members;

create trigger populate_organization_member_email
before insert or update of user_id, email, role
on public.organization_members
for each row
execute function public.populate_organization_member_email();

create or replace function public.create_organization_invitation(
  target_organization_id uuid,
  target_email text,
  target_role text default 'member',
  expiration_days integer default 7
)
returns table (
  invitation_id uuid,
  invitation_token text,
  invitation_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_role text;
  normalized_email text;
  actor_email text;
  raw_token text;
  created_invitation public.organization_invitations%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select role
  into actor_role
  from public.organization_members
  where organization_id = target_organization_id
    and user_id = auth.uid();

  if actor_role is null or actor_role not in ('owner', 'admin') then
    raise exception 'organization_admin_required';
  end if;

  if target_role is null or target_role not in ('admin', 'member') then
    raise exception 'invalid_invitation_role';
  end if;

  if target_role = 'admin' and actor_role is distinct from 'owner' then
    raise exception 'owner_required_to_invite_admin';
  end if;

  if expiration_days is null or expiration_days < 1 or expiration_days > 30 then
    raise exception 'invalid_invitation_expiration';
  end if;

  normalized_email := public.normalize_email(target_email);

  if normalized_email is null
    or normalized_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  then
    raise exception 'invalid_email';
  end if;

  select lower(email)
  into actor_email
  from auth.users
  where id = auth.uid();

  if normalized_email = actor_email then
    raise exception 'cannot_invite_yourself';
  end if;

  update public.organization_invitations
  set
    status = 'expired',
    token_hash = encode(
      digest(encode(gen_random_bytes(32), 'hex'), 'sha256'),
      'hex'
    ),
    updated_at = now()
  where organization_id = target_organization_id
    and status = 'pending'
    and expires_at <= now();

  if exists (
    select 1
    from public.organization_members as memberships
    left join auth.users as member_users
      on member_users.id = memberships.user_id
    where memberships.organization_id = target_organization_id
      and (
        lower(memberships.email) = normalized_email
        or lower(member_users.email) = normalized_email
      )
  ) then
    raise exception 'already_organization_member';
  end if;

  if exists (
    select 1
    from public.organization_invitations
    where organization_id = target_organization_id
      and lower(email) = normalized_email
      and status = 'pending'
  ) then
    raise exception 'pending_invitation_exists';
  end if;

  raw_token := encode(gen_random_bytes(32), 'hex');

  insert into public.organization_invitations (
    organization_id,
    email,
    role,
    token_hash,
    status,
    invited_by,
    expires_at
  )
  values (
    target_organization_id,
    normalized_email,
    target_role,
    encode(digest(raw_token, 'sha256'), 'hex'),
    'pending',
    auth.uid(),
    now() + make_interval(days => expiration_days)
  )
  returning * into created_invitation;

  insert into public.organization_membership_events (
    organization_id,
    invitation_id,
    event_type,
    actor_user_id,
    subject_email,
    to_role,
    metadata
  )
  values (
    target_organization_id,
    created_invitation.id,
    'invitation_created',
    auth.uid(),
    normalized_email,
    target_role,
    jsonb_build_object(
      'expires_at', created_invitation.expires_at
    )
  );

  return query
  select
    created_invitation.id,
    raw_token,
    created_invitation.expires_at;
end;
$$;

create or replace function public.preview_organization_invitation(
  invitation_token text
)
returns table (
  invitation_id uuid,
  organization_id uuid,
  organization_name text,
  invited_email text,
  invitation_role text,
  invitation_status text,
  invitation_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_invitation public.organization_invitations%rowtype;
begin
  select invitations.*
  into target_invitation
  from public.organization_invitations as invitations
  where invitations.token_hash = encode(digest(invitation_token, 'sha256'), 'hex')
  limit 1
  for update;

  if target_invitation.id is null then
    return;
  end if;

  if target_invitation.status = 'pending'
    and target_invitation.expires_at <= now()
  then
    update public.organization_invitations
    set
      status = 'expired',
      token_hash = encode(
        digest(encode(gen_random_bytes(32), 'hex'), 'sha256'),
        'hex'
      ),
      updated_at = now()
    where id = target_invitation.id;

    insert into public.organization_membership_events (
      organization_id,
      invitation_id,
      event_type,
      subject_email,
      to_role
    )
    values (
      target_invitation.organization_id,
      target_invitation.id,
      'invitation_expired',
      target_invitation.email,
      target_invitation.role
    );

    target_invitation.status := 'expired';
  end if;

  return query
  select
    target_invitation.id,
    target_invitation.organization_id,
    organizations.name,
    target_invitation.email,
    target_invitation.role,
    target_invitation.status,
    target_invitation.expires_at
  from public.organizations
  where organizations.id = target_invitation.organization_id;
end;
$$;

create or replace function public.accept_organization_invitation(
  invitation_token text
)
returns table (
  accepted_organization_id uuid,
  accepted_organization_name text,
  accepted_role text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_invitation public.organization_invitations%rowtype;
  authenticated_email text;
  created_membership public.organization_members%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select lower(email)
  into authenticated_email
  from auth.users
  where id = auth.uid();

  select invitations.*
  into target_invitation
  from public.organization_invitations as invitations
  where invitations.token_hash = encode(digest(invitation_token, 'sha256'), 'hex')
  for update;

  if target_invitation.id is null then
    raise exception 'invitation_not_found';
  end if;

  if target_invitation.status <> 'pending' then
    raise exception 'invitation_not_pending';
  end if;

  if target_invitation.expires_at <= now() then
    raise exception 'invitation_expired';
  end if;

  if authenticated_email is null
    or authenticated_email <> target_invitation.email
  then
    raise exception 'invitation_email_mismatch';
  end if;

  if exists (
    select 1
    from public.organization_members
    where organization_id = target_invitation.organization_id
      and user_id = auth.uid()
  ) then
    raise exception 'already_organization_member';
  end if;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    email,
    invited_by,
    updated_at
  )
  values (
    target_invitation.organization_id,
    auth.uid(),
    target_invitation.role,
    authenticated_email,
    target_invitation.invited_by,
    now()
  )
  returning * into created_membership;

  update public.organization_invitations
  set
    status = 'accepted',
    token_hash = encode(
      digest(encode(gen_random_bytes(32), 'hex'), 'sha256'),
      'hex'
    ),
    accepted_by = auth.uid(),
    accepted_at = now(),
    updated_at = now()
  where id = target_invitation.id;

  insert into public.organization_membership_events (
    organization_id,
    membership_id,
    invitation_id,
    event_type,
    actor_user_id,
    subject_user_id,
    subject_email,
    to_role
  )
  values
  (
    target_invitation.organization_id,
    created_membership.id,
    target_invitation.id,
    'invitation_accepted',
    auth.uid(),
    auth.uid(),
    authenticated_email,
    target_invitation.role
  ),
  (
    target_invitation.organization_id,
    created_membership.id,
    target_invitation.id,
    'member_added',
    target_invitation.invited_by,
    auth.uid(),
    authenticated_email,
    target_invitation.role
  );

  return query
  select
    target_invitation.organization_id,
    organizations.name,
    target_invitation.role
  from public.organizations
  where organizations.id = target_invitation.organization_id;
end;
$$;

create or replace function public.revoke_organization_invitation(
  target_invitation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_invitation public.organization_invitations%rowtype;
  actor_role text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select invitations.*
  into target_invitation
  from public.organization_invitations as invitations
  where invitations.id = target_invitation_id
  for update;

  if target_invitation.id is null then
    raise exception 'invitation_not_found';
  end if;

  select role
  into actor_role
  from public.organization_members
  where organization_id = target_invitation.organization_id
    and user_id = auth.uid();

  if actor_role is null or actor_role not in ('owner', 'admin') then
    raise exception 'organization_admin_required';
  end if;

  if target_invitation.status <> 'pending' then
    raise exception 'invitation_not_pending';
  end if;

  update public.organization_invitations
  set
    status = 'revoked',
    token_hash = encode(
      digest(encode(gen_random_bytes(32), 'hex'), 'sha256'),
      'hex'
    ),
    revoked_at = now(),
    updated_at = now()
  where id = target_invitation.id;

  insert into public.organization_membership_events (
    organization_id,
    invitation_id,
    event_type,
    actor_user_id,
    subject_email,
    to_role
  )
  values (
    target_invitation.organization_id,
    target_invitation.id,
    'invitation_revoked',
    auth.uid(),
    target_invitation.email,
    target_invitation.role
  );
end;
$$;

create or replace function public.update_organization_member_role(
  target_membership_id uuid,
  target_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_membership public.organization_members%rowtype;
  actor_role text;
  previous_role text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  if target_role is null or target_role not in ('admin', 'member') then
    raise exception 'invalid_membership_role';
  end if;

  select memberships.*
  into target_membership
  from public.organization_members as memberships
  where memberships.id = target_membership_id
  for update;

  if target_membership.id is null then
    raise exception 'membership_not_found';
  end if;

  select role
  into actor_role
  from public.organization_members
  where organization_id = target_membership.organization_id
    and user_id = auth.uid();

  if actor_role is distinct from 'owner' then
    raise exception 'owner_required';
  end if;

  if target_membership.role = 'owner' then
    raise exception 'use_ownership_transfer';
  end if;

  if target_membership.user_id = auth.uid() then
    raise exception 'cannot_change_own_role';
  end if;

  previous_role := target_membership.role;

  if previous_role = target_role then
    return;
  end if;

  update public.organization_members
  set
    role = target_role,
    updated_at = now()
  where id = target_membership.id;

  insert into public.organization_membership_events (
    organization_id,
    membership_id,
    event_type,
    actor_user_id,
    subject_user_id,
    subject_email,
    from_role,
    to_role
  )
  values (
    target_membership.organization_id,
    target_membership.id,
    'member_role_changed',
    auth.uid(),
    target_membership.user_id,
    target_membership.email,
    previous_role,
    target_role
  );
end;
$$;

create or replace function public.remove_organization_member(
  target_membership_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_membership public.organization_members%rowtype;
  actor_role text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select memberships.*
  into target_membership
  from public.organization_members as memberships
  where memberships.id = target_membership_id
  for update;

  if target_membership.id is null then
    raise exception 'membership_not_found';
  end if;

  select role
  into actor_role
  from public.organization_members
  where organization_id = target_membership.organization_id
    and user_id = auth.uid();

  if actor_role is null or actor_role not in ('owner', 'admin') then
    raise exception 'organization_admin_required';
  end if;

  if target_membership.role = 'owner' then
    raise exception 'cannot_remove_owner';
  end if;

  if actor_role = 'admin' and target_membership.role = 'admin' then
    raise exception 'owner_required_to_remove_admin';
  end if;

  if target_membership.user_id = auth.uid() then
    raise exception 'use_leave_organization';
  end if;

  insert into public.organization_membership_events (
    organization_id,
    membership_id,
    event_type,
    actor_user_id,
    subject_user_id,
    subject_email,
    from_role
  )
  values (
    target_membership.organization_id,
    target_membership.id,
    'member_removed',
    auth.uid(),
    target_membership.user_id,
    target_membership.email,
    target_membership.role
  );

  delete from public.organization_members
  where id = target_membership.id;
end;
$$;

create or replace function public.leave_organization(
  target_organization_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_membership public.organization_members%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select memberships.*
  into target_membership
  from public.organization_members as memberships
  where memberships.organization_id = target_organization_id
    and memberships.user_id = auth.uid()
  for update;

  if target_membership.id is null then
    raise exception 'membership_not_found';
  end if;

  if target_membership.role = 'owner' then
    raise exception 'owner_must_transfer_ownership';
  end if;

  insert into public.organization_membership_events (
    organization_id,
    membership_id,
    event_type,
    actor_user_id,
    subject_user_id,
    subject_email,
    from_role
  )
  values (
    target_membership.organization_id,
    target_membership.id,
    'member_left',
    auth.uid(),
    auth.uid(),
    target_membership.email,
    target_membership.role
  );

  delete from public.organization_members
  where id = target_membership.id;
end;
$$;

create or replace function public.transfer_organization_ownership(
  target_membership_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_owner public.organization_members%rowtype;
  next_owner public.organization_members%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select memberships.*
  into current_owner
  from public.organization_members as memberships
  where memberships.user_id = auth.uid()
    and memberships.role = 'owner'
    and memberships.organization_id = (
      select organization_id
      from public.organization_members
      where id = target_membership_id
    )
  for update;

  if current_owner.id is null then
    raise exception 'owner_required';
  end if;

  select memberships.*
  into next_owner
  from public.organization_members as memberships
  where memberships.id = target_membership_id
    and memberships.organization_id = current_owner.organization_id
  for update;

  if next_owner.id is null then
    raise exception 'membership_not_found';
  end if;

  if next_owner.user_id = auth.uid() then
    raise exception 'already_owner';
  end if;

  if next_owner.role not in ('admin', 'member') then
    raise exception 'invalid_next_owner';
  end if;

  update public.organization_members
  set
    role = 'admin',
    updated_at = now()
  where id = current_owner.id;

  update public.organization_members
  set
    role = 'owner',
    updated_at = now()
  where id = next_owner.id;

  insert into public.organization_membership_events (
    organization_id,
    membership_id,
    event_type,
    actor_user_id,
    subject_user_id,
    subject_email,
    from_role,
    to_role,
    metadata
  )
  values (
    current_owner.organization_id,
    next_owner.id,
    'ownership_transferred',
    auth.uid(),
    next_owner.user_id,
    next_owner.email,
    next_owner.role,
    'owner',
    jsonb_build_object(
      'previous_owner_user_id', current_owner.user_id,
      'previous_owner_email', current_owner.email,
      'previous_owner_new_role', 'admin'
    )
  );
end;
$$;

alter table public.organization_invitations enable row level security;
alter table public.organization_membership_events enable row level security;

drop policy if exists "Users can read their own memberships" on public.organization_members;
drop policy if exists "Organization admins can read memberships" on public.organization_members;
drop policy if exists "Organization admins can create memberships" on public.organization_members;
drop policy if exists "Organization admins can manage memberships" on public.organization_members;
drop policy if exists "Organization admins can delete memberships" on public.organization_members;

create policy "Organization members can read memberships"
on public.organization_members
for select
to authenticated
using (public.is_org_member(organization_id));

drop policy if exists "Organization admins can read invitations" on public.organization_invitations;
create policy "Organization admins can read invitations"
on public.organization_invitations
for select
to authenticated
using (public.is_org_admin(organization_id));

drop policy if exists "Organization admins can read membership events" on public.organization_membership_events;
create policy "Organization admins can read membership events"
on public.organization_membership_events
for select
to authenticated
using (public.is_org_admin(organization_id));

revoke all on public.organization_invitations from anon, authenticated;
revoke all on public.organization_membership_events from anon, authenticated;

grant select on public.organization_invitations to authenticated;
grant select on public.organization_membership_events to authenticated;

revoke all on function public.create_organization_invitation(uuid, text, text, integer) from public;
revoke all on function public.preview_organization_invitation(text) from public;
revoke all on function public.accept_organization_invitation(text) from public;
revoke all on function public.revoke_organization_invitation(uuid) from public;
revoke all on function public.update_organization_member_role(uuid, text) from public;
revoke all on function public.remove_organization_member(uuid) from public;
revoke all on function public.leave_organization(uuid) from public;
revoke all on function public.transfer_organization_ownership(uuid) from public;

grant execute on function public.create_organization_invitation(uuid, text, text, integer) to authenticated;
grant execute on function public.preview_organization_invitation(text) to anon, authenticated;
grant execute on function public.accept_organization_invitation(text) to authenticated;
grant execute on function public.revoke_organization_invitation(uuid) to authenticated;
grant execute on function public.update_organization_member_role(uuid, text) to authenticated;
grant execute on function public.remove_organization_member(uuid) to authenticated;
grant execute on function public.leave_organization(uuid) to authenticated;
grant execute on function public.transfer_organization_ownership(uuid) to authenticated;
