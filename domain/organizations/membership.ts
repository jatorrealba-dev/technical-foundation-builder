export const organizationRoles = [
  "owner",
  "admin",
  "member",
] as const;

export type OrganizationRole =
  (typeof organizationRoles)[number];

export function isOrganizationRole(
  value: string
): value is OrganizationRole {
  return organizationRoles.includes(
    value as OrganizationRole
  );
}

export function canManageAgentReviews(
  role: string | null | undefined
): boolean {
  return role === "owner" || role === "admin";
}
