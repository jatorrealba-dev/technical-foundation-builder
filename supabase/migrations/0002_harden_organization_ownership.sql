alter table public.organizations
add column if not exists created_by uuid references auth.users(id) on delete set null;

create index if not exists idx_organizations_created_by
on public.organizations(created_by);

drop policy if exists "Users can create organizations" on public.organizations;
drop policy if exists "Users can create their first owner membership" on public.organization_members;

create policy "Users can create organizations for themselves"
on public.organizations
for insert
to authenticated
with check (created_by = auth.uid());

create policy "Users can create owner membership for organizations they created"
on public.organization_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  and role = 'owner'
  and exists (
    select 1
    from public.organizations
    where organizations.id = organization_members.organization_id
      and organizations.created_by = auth.uid()
  )
);

create policy "Organization admins can create memberships"
on public.organization_members
for insert
to authenticated
with check (public.is_org_admin(organization_id));
