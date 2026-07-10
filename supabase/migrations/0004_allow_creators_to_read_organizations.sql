drop policy if exists "Users can read organizations they created"
on public.organizations;

create policy "Users can read organizations they created"
on public.organizations
for select
to authenticated
using (created_by = auth.uid());
