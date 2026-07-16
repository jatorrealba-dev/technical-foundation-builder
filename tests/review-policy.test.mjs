import assert from "node:assert/strict";
import test from "node:test";

import {
  canManageAgentReviews,
  isOrganizationRole,
} from "../domain/organizations/membership.ts";

test("owner and admin can manage agent reviews", () => {
  assert.equal(
    canManageAgentReviews("owner"),
    true
  );
  assert.equal(
    canManageAgentReviews("admin"),
    true
  );
});

test("member and unknown roles cannot manage reviews", () => {
  assert.equal(
    canManageAgentReviews("member"),
    false
  );
  assert.equal(
    canManageAgentReviews("viewer"),
    false
  );
  assert.equal(
    canManageAgentReviews(null),
    false
  );
});

test("organization role guard accepts only known roles", () => {
  assert.equal(isOrganizationRole("owner"), true);
  assert.equal(isOrganizationRole("member"), true);
  assert.equal(isOrganizationRole("viewer"), false);
});
