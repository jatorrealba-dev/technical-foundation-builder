"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

function getFormValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function invitationPath(token: string, error?: string): string {
  const base = `/invitations/${encodeURIComponent(token)}`;
  return error
    ? `${base}?error=${encodeURIComponent(error)}`
    : base;
}

function mapInvitationError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("invitation_email_mismatch")) {
    return "La cuenta iniciada no coincide con el correo invitado.";
  }

  if (normalized.includes("invitation_expired")) {
    return "La invitación expiró. Solicita una nueva al administrador.";
  }

  if (normalized.includes("invitation_not_pending")) {
    return "La invitación ya fue aceptada, revocada o expiró.";
  }

  if (normalized.includes("already_organization_member")) {
    return "Ya perteneces a esta organización.";
  }

  if (normalized.includes("invitation_not_found")) {
    return "La invitación no existe o el enlace es inválido.";
  }

  return message;
}

export async function acceptOrganizationInvitationAction(
  formData: FormData
) {
  const token = getFormValue(formData, "token");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(invitationPath(token))}`);
  }

  const { data, error } = await supabase.rpc(
    "accept_organization_invitation",
    { invitation_token: token }
  );

  if (error) {
    redirect(invitationPath(token, mapInvitationError(error.message)));
  }

  const accepted = Array.isArray(data) ? data[0] : data;
  const organizationId = accepted?.accepted_organization_id;

  if (typeof organizationId !== "string" || !organizationId) {
    redirect(invitationPath(token, "La invitación se aceptó sin organización de destino."));
  }

  redirect(`/dashboard?organizationId=${encodeURIComponent(organizationId)}&joined=1`);
}
