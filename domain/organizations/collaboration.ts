import type { OrganizationRole } from "@/domain/organizations/membership";

export const invitationRoles = ["admin", "member"] as const;

export type InvitationRole = (typeof invitationRoles)[number];

export const invitationStatuses = [
  "pending",
  "accepted",
  "revoked",
  "expired",
] as const;

export type InvitationStatus = (typeof invitationStatuses)[number];

export function isInvitationRole(value: string): value is InvitationRole {
  return invitationRoles.includes(value as InvitationRole);
}

export function canManageTeam(
  role: OrganizationRole | string | null | undefined
): boolean {
  return role === "owner" || role === "admin";
}

export function canInviteRole(input: {
  actorRole: OrganizationRole | string | null | undefined;
  invitedRole: InvitationRole;
}): boolean {
  if (input.actorRole === "owner") {
    return true;
  }

  return input.actorRole === "admin" && input.invitedRole === "member";
}

export function canChangeMemberRole(
  role: OrganizationRole | string | null | undefined
): boolean {
  return role === "owner";
}

export function canRemoveMembership(input: {
  actorRole: OrganizationRole | string | null | undefined;
  targetRole: OrganizationRole | string;
  isSelf: boolean;
}): boolean {
  if (input.isSelf || input.targetRole === "owner") {
    return false;
  }

  if (input.actorRole === "owner") {
    return true;
  }

  return input.actorRole === "admin" && input.targetRole === "member";
}

export function getOrganizationRoleLabel(role: string): string {
  switch (role) {
    case "owner":
      return "Propietario";
    case "admin":
      return "Administrador";
    case "member":
      return "Miembro";
    default:
      return role;
  }
}

export function getInvitationStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Pendiente";
    case "accepted":
      return "Aceptada";
    case "revoked":
      return "Revocada";
    case "expired":
      return "Expirada";
    default:
      return status;
  }
}

export function isSafeInternalPath(
  value: string | null | undefined
): value is string {
  if (!value) {
    return false;
  }

  return (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !value.includes("\\") &&
    !/[\r\n]/.test(value)
  );
}

export function normalizeInvitationEmail(value: string): string {
  return value.trim().toLowerCase();
}
