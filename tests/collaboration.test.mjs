import assert from "node:assert/strict";
import test from "node:test";

import {
  canChangeMemberRole,
  canInviteRole,
  canManageTeam,
  canRemoveMembership,
  isSafeInternalPath,
  normalizeInvitationEmail,
} from "../domain/organizations/collaboration.ts";

test("owner and admin manage teams while members cannot", () => {
  assert.equal(canManageTeam("owner"), true);
  assert.equal(canManageTeam("admin"), true);
  assert.equal(canManageTeam("member"), false);
});

test("only owners invite admins while admins can invite members", () => {
  assert.equal(canInviteRole({ actorRole: "owner", invitedRole: "admin" }), true);
  assert.equal(canInviteRole({ actorRole: "admin", invitedRole: "admin" }), false);
  assert.equal(canInviteRole({ actorRole: "admin", invitedRole: "member" }), true);
  assert.equal(canInviteRole({ actorRole: "member", invitedRole: "member" }), false);
});

test("only owners change membership roles", () => {
  assert.equal(canChangeMemberRole("owner"), true);
  assert.equal(canChangeMemberRole("admin"), false);
  assert.equal(canChangeMemberRole("member"), false);
});

test("membership removal protects owners, peers and self removal", () => {
  assert.equal(
    canRemoveMembership({ actorRole: "owner", targetRole: "admin", isSelf: false }),
    true
  );
  assert.equal(
    canRemoveMembership({ actorRole: "admin", targetRole: "admin", isSelf: false }),
    false
  );
  assert.equal(
    canRemoveMembership({ actorRole: "admin", targetRole: "member", isSelf: false }),
    true
  );
  assert.equal(
    canRemoveMembership({ actorRole: "owner", targetRole: "owner", isSelf: false }),
    false
  );
  assert.equal(
    canRemoveMembership({ actorRole: "owner", targetRole: "member", isSelf: true }),
    false
  );
});

test("invitation helpers normalize email and reject external redirects", () => {
  assert.equal(normalizeInvitationEmail("  Jose@Example.COM "), "jose@example.com");
  assert.equal(isSafeInternalPath("/invitations/token"), true);
  assert.equal(isSafeInternalPath("//evil.example"), false);
  assert.equal(isSafeInternalPath("https://evil.example"), false);
  assert.equal(isSafeInternalPath("/\\evil.example"), false);
  assert.equal(isSafeInternalPath("/safe\nLocation: https://evil.example"), false);
});
