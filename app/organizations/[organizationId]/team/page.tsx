import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  createOrganizationInvitationAction,
  leaveOrganizationAction,
  removeOrganizationMemberAction,
  revokeOrganizationInvitationAction,
  transferOrganizationOwnershipAction,
  updateOrganizationMemberRoleAction,
} from "@/app/organizations/[organizationId]/team/actions";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  canChangeMemberRole,
  canInviteRole,
  canManageTeam,
  canRemoveMembership,
  getInvitationStatusLabel,
  getOrganizationRoleLabel,
} from "@/domain/organizations/collaboration";
import type { OrganizationRole } from "@/domain/organizations/membership";
import { createClient } from "@/lib/supabase/server";

type TeamPageProps = {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{
    error?: string;
    invited?: string;
    token?: string;
    revoked?: string;
    updated?: string;
    removed?: string;
    transferred?: string;
  }>;
};

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
};

type MembershipRow = {
  id: string;
  user_id: string;
  email: string | null;
  role: OrganizationRole;
  created_at: string;
};

type InvitationRow = {
  id: string;
  email: string;
  role: "admin" | "member";
  status: string;
  expires_at: string;
  created_at: string;
};

type MembershipEventRow = {
  id: string;
  event_type: string;
  subject_email: string | null;
  from_role: string | null;
  to_role: string | null;
  created_at: string;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getEventLabel(event: MembershipEventRow): string {
  switch (event.event_type) {
    case "invitation_created":
      return `Invitación creada para ${event.subject_email ?? "un correo"}`;
    case "invitation_revoked":
      return `Invitación revocada para ${event.subject_email ?? "un correo"}`;
    case "invitation_expired":
      return `Invitación expirada para ${event.subject_email ?? "un correo"}`;
    case "invitation_accepted":
      return `${event.subject_email ?? "Un usuario"} aceptó la invitación`;
    case "member_added":
      return `${event.subject_email ?? "Un usuario"} se incorporó al equipo`;
    case "member_role_changed":
      return `${event.subject_email ?? "Un miembro"}: ${getOrganizationRoleLabel(
        event.from_role ?? ""
      )} → ${getOrganizationRoleLabel(event.to_role ?? "")}`;
    case "member_removed":
      return `${event.subject_email ?? "Un miembro"} fue removido`;
    case "member_left":
      return `${event.subject_email ?? "Un miembro"} salió de la organización`;
    case "ownership_transferred":
      return `Propiedad transferida a ${event.subject_email ?? "otro miembro"}`;
    default:
      return event.event_type;
  }
}

export default async function TeamPage({
  params,
  searchParams,
}: TeamPageProps) {
  const { organizationId } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membershipData, error: membershipError } = await supabase
    .from("organization_members")
    .select("id, user_id, email, role, created_at")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membershipData) {
    redirect("/dashboard?error=No%20tienes%20acceso%20a%20esa%20organizacion.");
  }

  const currentMembership = membershipData as unknown as MembershipRow;

  const [organizationResult, membersResult] = await Promise.all([
    supabase
      .from("organizations")
      .select("id, name, slug")
      .eq("id", organizationId)
      .maybeSingle(),
    supabase
      .from("organization_members")
      .select("id, user_id, email, role, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true }),
  ]);

  if (organizationResult.error) {
    throw new Error(organizationResult.error.message);
  }

  if (membersResult.error) {
    throw new Error(membersResult.error.message);
  }

  if (!organizationResult.data) {
    redirect("/dashboard");
  }

  const organization = organizationResult.data as unknown as OrganizationRow;
  const members = (membersResult.data ?? []) as unknown as MembershipRow[];
  const managesTeam = canManageTeam(currentMembership.role);

  let invitations: InvitationRow[] = [];
  let events: MembershipEventRow[] = [];

  if (managesTeam) {
    const [invitationsResult, eventsResult] = await Promise.all([
      supabase
        .from("organization_invitations")
        .select("id, email, role, status, expires_at, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false }),
      supabase
        .from("organization_membership_events")
        .select("id, event_type, subject_email, from_role, to_role, created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (invitationsResult.error) {
      throw new Error(invitationsResult.error.message);
    }

    if (eventsResult.error) {
      throw new Error(eventsResult.error.message);
    }

    invitations = (invitationsResult.data ?? []) as unknown as InvitationRow[];
    events = (eventsResult.data ?? []) as unknown as MembershipEventRow[];
  }

  let inviteLink: string | null = null;

  if (query.token) {
    const requestHeaders = await headers();
    const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
    const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

    if (host) {
      inviteLink = `${protocol}://${host}/invitations/${encodeURIComponent(query.token)}`;
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <Button variant="ghost" asChild className="mb-3 px-0">
              <Link href={`/dashboard?organizationId=${organizationId}`}>
                ← Volver al dashboard
              </Link>
            </Button>

            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">
                Equipo de {organization.name}
              </h1>
              <Badge variant="secondary">
                {getOrganizationRoleLabel(currentMembership.role)}
              </Badge>
            </div>

            <p className="mt-2 max-w-3xl text-muted-foreground">
              Administra membresías, invitaciones, roles y transferencia de
              propiedad con auditoría persistente.
            </p>
          </div>

          <Button variant="outline" asChild>
            <Link href={`/organizations/${organizationId}/settings/ai`}>
              Operación de IA
            </Link>
          </Button>
        </div>

        {query.error ? (
          <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {query.error}
          </div>
        ) : null}

        {query.invited === "1" && inviteLink ? (
          <Card className="mb-6 border-primary/30">
            <CardHeader>
              <CardTitle>Invitación creada</CardTitle>
              <CardDescription>
                Comparte este enlace únicamente con la persona invitada. El
                enlace expira en siete días y se muestra una sola vez en esta
                respuesta.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input value={inviteLink} readOnly aria-label="Enlace de invitación" />
              <CopyToClipboardButton value={inviteLink} />
            </CardContent>
          </Card>
        ) : null}

        {query.revoked === "1" || query.updated === "1" || query.removed === "1" || query.transferred === "1" ? (
          <div className="mb-6 rounded-md border bg-muted px-4 py-3 text-sm text-muted-foreground">
            El cambio del equipo se guardó correctamente.
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Miembros</CardTitle>
                <CardDescription>
                  {members.length} {members.length === 1 ? "persona" : "personas"} con acceso a la organización.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {members.map((member) => {
                  const isSelf = member.user_id === user.id;
                  const canChangeRole =
                    canChangeMemberRole(currentMembership.role) &&
                    member.role !== "owner" &&
                    !isSelf;
                  const canRemove = canRemoveMembership({
                    actorRole: currentMembership.role,
                    targetRole: member.role,
                    isSelf,
                  });

                  return (
                    <div
                      key={member.id}
                      className="rounded-lg border p-4"
                    >
                      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">
                              {member.email ?? "Correo no disponible"}
                            </p>
                            {isSelf ? <Badge variant="outline">Tú</Badge> : null}
                            <Badge variant="secondary">
                              {getOrganizationRoleLabel(member.role)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Miembro desde {formatDate(member.created_at)}
                          </p>
                        </div>
                      </div>

                      {canChangeRole || canRemove || (currentMembership.role === "owner" && member.role !== "owner" && !isSelf) ? (
                        <div className="mt-4 grid gap-3 border-t pt-4">
                          {canChangeRole ? (
                            <form
                              action={updateOrganizationMemberRoleAction}
                              className="flex flex-col gap-2 sm:flex-row"
                            >
                              <input type="hidden" name="organizationId" value={organizationId} />
                              <input type="hidden" name="membershipId" value={member.id} />
                              <select
                                name="role"
                                defaultValue={member.role}
                                className="h-9 rounded-md border bg-background px-3 text-sm"
                              >
                                <option value="member">Miembro</option>
                                <option value="admin">Administrador</option>
                              </select>
                              <Button type="submit" variant="outline">
                                Actualizar rol
                              </Button>
                            </form>
                          ) : null}

                          {currentMembership.role === "owner" && member.role !== "owner" && !isSelf ? (
                            <form
                              action={transferOrganizationOwnershipAction}
                              className="grid gap-2 rounded-md border border-amber-500/30 p-3"
                            >
                              <input type="hidden" name="organizationId" value={organizationId} />
                              <input type="hidden" name="membershipId" value={member.id} />
                              <Label htmlFor={`transfer-${member.id}`}>
                                Transferir propiedad a este miembro
                              </Label>
                              <div className="flex flex-col gap-2 sm:flex-row">
                                <Input
                                  id={`transfer-${member.id}`}
                                  name="confirmation"
                                  placeholder="Escribe TRANSFERIR"
                                  required
                                />
                                <Button type="submit" variant="outline">
                                  Transferir propiedad
                                </Button>
                              </div>
                            </form>
                          ) : null}

                          {canRemove ? (
                            <form action={removeOrganizationMemberAction}>
                              <input type="hidden" name="organizationId" value={organizationId} />
                              <input type="hidden" name="membershipId" value={member.id} />
                              <Button type="submit" variant="destructive">
                                Remover miembro
                              </Button>
                            </form>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {managesTeam ? (
              <Card>
                <CardHeader>
                  <CardTitle>Invitaciones</CardTitle>
                  <CardDescription>
                    Los enlaces se aceptan únicamente con una cuenta cuyo correo coincida con la invitación.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form action={createOrganizationInvitationAction} className="grid gap-4 rounded-lg border p-4">
                    <input type="hidden" name="organizationId" value={organizationId} />
                    <div className="grid gap-2">
                      <Label htmlFor="email">Correo</Label>
                      <Input id="email" name="email" type="email" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="role">Rol</Label>
                      <select
                        id="role"
                        name="role"
                        defaultValue="member"
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                      >
                        <option value="member">Miembro</option>
                        {canInviteRole({ actorRole: currentMembership.role, invitedRole: "admin" }) ? (
                          <option value="admin">Administrador</option>
                        ) : null}
                      </select>
                    </div>
                    <Button type="submit">Crear invitación</Button>
                  </form>

                  {invitations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No hay invitaciones todavía.
                    </p>
                  ) : (
                    invitations.map((invitation) => (
                      <div key={invitation.id} className="flex flex-col justify-between gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{invitation.email}</p>
                            <Badge variant="outline">
                              {getOrganizationRoleLabel(invitation.role)}
                            </Badge>
                            <Badge variant="secondary">
                              {getInvitationStatusLabel(invitation.status)}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Expira {formatDate(invitation.expires_at)}
                          </p>
                        </div>

                        {invitation.status === "pending" ? (
                          <form action={revokeOrganizationInvitationAction}>
                            <input type="hidden" name="organizationId" value={organizationId} />
                            <input type="hidden" name="invitationId" value={invitation.id} />
                            <Button type="submit" variant="outline">
                              Revocar
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Permisos actuales</CardTitle>
                <CardDescription>
                  Matriz de acceso de la organización.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="font-medium">Propietario</p>
                  <p className="text-muted-foreground">
                    Control total, roles de administradores y transferencia de propiedad.
                  </p>
                </div>
                <div>
                  <p className="font-medium">Administrador</p>
                  <p className="text-muted-foreground">
                    Invita y remueve miembros, y gobierna revisiones del producto.
                  </p>
                </div>
                <div>
                  <p className="font-medium">Miembro</p>
                  <p className="text-muted-foreground">
                    Trabaja en proyectos, entrevistas, modelos y documentos.
                  </p>
                </div>
              </CardContent>
            </Card>

            {managesTeam ? (
              <Card>
                <CardHeader>
                  <CardTitle>Actividad reciente</CardTitle>
                  <CardDescription>
                    Auditoría de invitaciones y cambios de membresía.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {events.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay eventos todavía.</p>
                  ) : (
                    events.map((event) => (
                      <div key={event.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                        <p className="text-sm font-medium">{getEventLabel(event)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatDate(event.created_at)}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ) : null}

            {currentMembership.role !== "owner" ? (
              <Card className="border-destructive/30">
                <CardHeader>
                  <CardTitle>Salir de la organización</CardTitle>
                  <CardDescription>
                    Perderás acceso a todos sus proyectos y documentos.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form action={leaveOrganizationAction} className="space-y-3">
                    <input type="hidden" name="organizationId" value={organizationId} />
                    <Label htmlFor="leave-confirmation">Escribe SALIR</Label>
                    <Input id="leave-confirmation" name="confirmation" required />
                    <Button type="submit" variant="destructive">
                      Salir de la organización
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
