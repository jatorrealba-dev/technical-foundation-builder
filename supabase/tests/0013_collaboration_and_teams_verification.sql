-- Ejecutar en Supabase SQL Editor después de aplicar 0013.
-- Sustituye <ORGANIZATION_ID> y <USER_ID> cuando corresponda.

select
  id,
  organization_id,
  user_id,
  email,
  role,
  invited_by,
  created_at,
  updated_at
from public.organization_members
where organization_id = '<ORGANIZATION_ID>'::uuid
order by created_at;

select
  id,
  email,
  role,
  status,
  invited_by,
  accepted_by,
  expires_at,
  accepted_at,
  revoked_at,
  created_at
from public.organization_invitations
where organization_id = '<ORGANIZATION_ID>'::uuid
order by created_at desc;

select
  event_type,
  actor_user_id,
  subject_user_id,
  subject_email,
  from_role,
  to_role,
  metadata,
  created_at
from public.organization_membership_events
where organization_id = '<ORGANIZATION_ID>'::uuid
order by created_at desc;

-- Debe devolver como máximo una invitación pendiente por correo.
select
  lower(email) as normalized_email,
  count(*)
from public.organization_invitations
where organization_id = '<ORGANIZATION_ID>'::uuid
  and status = 'pending'
group by lower(email)
having count(*) > 1;

-- Debe devolver exactamente un propietario.
select count(*) as owner_count
from public.organization_members
where organization_id = '<ORGANIZATION_ID>'::uuid
  and role = 'owner';

-- No debe devolver membresías con correo desnormalizado.
select id, email
from public.organization_members
where organization_id = '<ORGANIZATION_ID>'::uuid
  and email is not null
  and email <> lower(trim(email));

-- Confirma las funciones de colaboración instaladas.
select
  routine_name,
  security_type
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'create_organization_invitation',
    'preview_organization_invitation',
    'accept_organization_invitation',
    'revoke_organization_invitation',
    'update_organization_member_role',
    'remove_organization_member',
    'leave_organization',
    'transfer_organization_ownership'
  )
order by routine_name;
