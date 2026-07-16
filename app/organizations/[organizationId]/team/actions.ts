"use server";

import { redirect } from "next/navigation";

import {
  isInvitationRole,
  normalizeInvitationEmail,
} from "@/domain/organizations/collaboration";
import { createClient } from "@/lib/supabase/server";

function getFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function teamPath(organizationId: string, query?: URLSearchParams): string {
  const base = `/organizations/${organizationId}/team`;
  const suffix = query?.toString();
  return suffix ? `${base}?${suffix}` : base;
}

function mapTeamError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("organization_admin_required")) {
    return "Necesitas permisos de propietario o administrador.";
  }

  if (normalized.includes("owner_required_to_invite_admin")) {
    return "Solo el propietario puede invitar administradores.";
  }

  if (normalized.includes("pending_invitation_exists")) {
    return "Ya existe una invitación pendiente para ese correo.";
  }

  if (normalized.includes("already_organization_member")) {
    return "Ese correo ya pertenece a la organización.";
  }

  if (normalized.includes("cannot_invite_yourself")) {
    return "No puedes invitar tu propio correo.";
  }

  if (normalized.includes("owner_required")) {
    return "Esta operación requiere el rol de propietario.";
  }

  if (normalized.includes("cannot_remove_owner")) {
    return "El propietario no puede eliminarse. Primero transfiere la propiedad.";
  }

  if (normalized.includes("owner_required_to_remove_admin")) {
    return "Solo el propietario puede remover administradores.";
  }

  if (normalized.includes("owner_must_transfer_ownership")) {
    return "El propietario debe transferir la organización antes de salir.";
  }

  if (normalized.includes("invitation_not_pending")) {
    return "La invitación ya no está pendiente.";
  }

  return message;
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect("/login?error=Debes%20iniciar%20sesion.");
  }

  return { supabase, user };
}

export async function createOrganizationInvitationAction(
  formData: FormData
) {
  const organizationId = getFormValue(formData, "organizationId");
  const email = normalizeInvitationEmail(getFormValue(formData, "email"));
  const role = getFormValue(formData, "role");

  if (!organizationId || !email || !isInvitationRole(role)) {
    redirect(
      teamPath(
        organizationId,
        new URLSearchParams({ error: "Completa un correo y un rol válidos." })
      )
    );
  }

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc(
    "create_organization_invitation",
    {
      target_organization_id: organizationId,
      target_email: email,
      target_role: role,
      expiration_days: 7,
    }
  );

  if (error) {
    redirect(
      teamPath(
        organizationId,
        new URLSearchParams({ error: mapTeamError(error.message) })
      )
    );
  }

  const invitation = Array.isArray(data) ? data[0] : data;
  const token = invitation?.invitation_token;

  if (typeof token !== "string" || !token) {
    redirect(
      teamPath(
        organizationId,
        new URLSearchParams({
          error: "La invitación se creó, pero no fue posible recuperar el enlace.",
        })
      )
    );
  }

  redirect(
    teamPath(
      organizationId,
      new URLSearchParams({ invited: "1", token })
    )
  );
}

export async function revokeOrganizationInvitationAction(
  formData: FormData
) {
  const organizationId = getFormValue(formData, "organizationId");
  const invitationId = getFormValue(formData, "invitationId");
  const { supabase } = await requireUser();

  const { error } = await supabase.rpc("revoke_organization_invitation", {
    target_invitation_id: invitationId,
  });

  if (error) {
    redirect(
      teamPath(
        organizationId,
        new URLSearchParams({ error: mapTeamError(error.message) })
      )
    );
  }

  redirect(
    teamPath(
      organizationId,
      new URLSearchParams({ revoked: "1" })
    )
  );
}

export async function updateOrganizationMemberRoleAction(
  formData: FormData
) {
  const organizationId = getFormValue(formData, "organizationId");
  const membershipId = getFormValue(formData, "membershipId");
  const role = getFormValue(formData, "role");
  const { supabase } = await requireUser();

  const { error } = await supabase.rpc("update_organization_member_role", {
    target_membership_id: membershipId,
    target_role: role,
  });

  if (error) {
    redirect(
      teamPath(
        organizationId,
        new URLSearchParams({ error: mapTeamError(error.message) })
      )
    );
  }

  redirect(
    teamPath(
      organizationId,
      new URLSearchParams({ updated: "1" })
    )
  );
}

export async function removeOrganizationMemberAction(formData: FormData) {
  const organizationId = getFormValue(formData, "organizationId");
  const membershipId = getFormValue(formData, "membershipId");
  const { supabase } = await requireUser();

  const { error } = await supabase.rpc("remove_organization_member", {
    target_membership_id: membershipId,
  });

  if (error) {
    redirect(
      teamPath(
        organizationId,
        new URLSearchParams({ error: mapTeamError(error.message) })
      )
    );
  }

  redirect(
    teamPath(
      organizationId,
      new URLSearchParams({ removed: "1" })
    )
  );
}

export async function transferOrganizationOwnershipAction(
  formData: FormData
) {
  const organizationId = getFormValue(formData, "organizationId");
  const membershipId = getFormValue(formData, "membershipId");
  const confirmation = getFormValue(formData, "confirmation");

  if (confirmation !== "TRANSFERIR") {
    redirect(
      teamPath(
        organizationId,
        new URLSearchParams({
          error: "Escribe TRANSFERIR para confirmar el cambio de propietario.",
        })
      )
    );
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("transfer_organization_ownership", {
    target_membership_id: membershipId,
  });

  if (error) {
    redirect(
      teamPath(
        organizationId,
        new URLSearchParams({ error: mapTeamError(error.message) })
      )
    );
  }

  redirect(
    teamPath(
      organizationId,
      new URLSearchParams({ transferred: "1" })
    )
  );
}

export async function leaveOrganizationAction(formData: FormData) {
  const organizationId = getFormValue(formData, "organizationId");
  const confirmation = getFormValue(formData, "confirmation");

  if (confirmation !== "SALIR") {
    redirect(
      teamPath(
        organizationId,
        new URLSearchParams({ error: "Escribe SALIR para confirmar." })
      )
    );
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("leave_organization", {
    target_organization_id: organizationId,
  });

  if (error) {
    redirect(
      teamPath(
        organizationId,
        new URLSearchParams({ error: mapTeamError(error.message) })
      )
    );
  }

  redirect("/dashboard?left=1");
}
