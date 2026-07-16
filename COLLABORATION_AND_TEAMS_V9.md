# Collaboration and Teams v9

## Scope

Version 9 adds organization-level collaboration without changing the existing project data model or introducing an external email provider.

The implemented workflow is:

```text
owner/admin creates invitation
→ application returns a shareable, high-entropy link
→ invited user signs in or registers with the invited email
→ PostgreSQL validates token, email, expiry and status
→ membership is created atomically
→ organization becomes available in the dashboard
→ audit events preserve the complete lifecycle
```

## Capabilities

### Team administration

New route:

```text
/organizations/[organizationId]/team
```

It provides:

- member directory;
- role badges;
- invitation creation and revocation;
- owner-controlled role changes;
- member removal with owner/admin constraints;
- ownership transfer;
- voluntary organization exit;
- recent membership audit activity.

### Invitations

New route:

```text
/invitations/[token]
```

Invitation rules:

- tokens use 32 random bytes and only their SHA-256 hash is stored;
- invitations expire after seven days by default;
- only the exact invited email can accept;
- invitations are single-use and their stored hash is rotated after acceptance, revocation or observed expiry;
- one pending invitation per organization and normalized email;
- admins may invite members;
- only owners may invite administrators;
- acceptance is transactional.

Email delivery is intentionally not integrated in v9. The application returns a shareable link that an owner or administrator can deliver through an existing communication channel.

### Membership governance

Roles remain:

```text
owner
admin
member
```

Rules:

- exactly one owner is expected per organization;
- the owner can promote or demote admins and members;
- admins cannot alter other admins;
- admins can remove members;
- the owner cannot be removed or leave without transferring ownership;
- ownership transfer demotes the previous owner to admin;
- self-removal uses the explicit leave workflow.

### Multiple organizations

The dashboard now loads every organization membership and supports switching the active organization through `organizationId`.

Project creation is pinned to the selected organization, preventing the previous first-membership ambiguity.

### Authentication return paths

Login and registration preserve a validated internal `next` path. Invitation recipients return to the invitation after authenticating. External and protocol-relative redirect targets are rejected.

## Persistence

Migration:

```text
0013_collaboration_and_teams.sql
```

Adds:

- normalized member email and invitation provenance on `organization_members`;
- `organization_invitations`;
- `organization_membership_events`;
- secure invitation and membership RPCs;
- team read policies and admin audit policies.

## RPC boundary

All collaboration writes are performed through security-definer functions:

```text
create_organization_invitation
preview_organization_invitation
accept_organization_invitation
revoke_organization_invitation
update_organization_member_role
remove_organization_member
leave_organization
transfer_organization_ownership
```

Direct admin insert, update and delete policies on `organization_members` are removed. Initial owner creation during onboarding remains available through the existing owner-creation policy.

## Explicit boundary

Version 9 is organization-level collaboration. Every organization member continues to access all projects in that organization according to the existing product model. Project-specific ACLs, per-project assignments and a read-only viewer role are not claimed by this release and require a separate policy migration.
