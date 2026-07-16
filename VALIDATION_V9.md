# Validation v9

## Automated validation

Run:

```bash
npm run check
```

Expected coverage:

- lint;
- TypeScript;
- collaboration permission helpers;
- invitation role rules;
- membership removal safeguards;
- internal redirect validation;
- all previous adaptive interview, readiness, consistency and governance tests;
- production build.

## Migration validation

Apply:

```bash
npx supabase db push
```

Expected migration:

```text
0013_collaboration_and_teams.sql
```

Verification queries are available in:

```text
supabase/tests/0013_collaboration_and_teams_verification.sql
```

## Connected acceptance test

1. Open the team page as owner.
2. Invite a second email as member.
3. Copy the generated link.
4. Open it in a private browser session.
5. Register or sign in using the exact invited email.
6. Accept the invitation.
7. Confirm that the second organization appears in the dashboard when applicable.
8. Confirm that the new member appears in the team directory.
9. Promote the member to admin as owner.
10. Confirm the role-change event.
11. Transfer ownership only in a disposable test organization.
12. Confirm the previous owner becomes admin and the target becomes owner.

## Negative tests

- wrong authenticated email cannot accept;
- expired, revoked or accepted invitations cannot be reused;
- duplicate pending invitation is rejected;
- admin cannot invite another admin;
- admin cannot remove or modify another admin;
- owner cannot leave without transferring ownership;
- a member cannot access invitation or audit management controls;
- an external `next` URL is never used as an authentication redirect.

## Delivery validation result

The packaged source was validated with:

```text
ESLint                         passed
TypeScript                     passed
Automated tests                29 passed, 0 failed
Next.js production build       passed
New application routes         present
PostgreSQL parser              57 statements parsed
```
