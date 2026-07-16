import Link from "next/link";

import { acceptOrganizationInvitationAction } from "@/app/invitations/[token]/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  getInvitationStatusLabel,
  getOrganizationRoleLabel,
} from "@/domain/organizations/collaboration";
import { createClient } from "@/lib/supabase/server";

type InvitationPageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
};

type InvitationPreview = {
  invitation_id: string;
  organization_id: string;
  organization_name: string;
  invited_email: string;
  invitation_role: string;
  invitation_status: string;
  invitation_expires_at: string;
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function InvitationPage({
  params,
  searchParams,
}: InvitationPageProps) {
  const { token } = await params;
  const query = await searchParams;
  const supabase = await createClient();

  const [{ data: previewData, error: previewError }, authResult] = await Promise.all([
    supabase.rpc("preview_organization_invitation", {
      invitation_token: token,
    }),
    supabase.auth.getUser(),
  ]);

  if (previewError) {
    throw new Error(previewError.message);
  }

  const preview = (
    Array.isArray(previewData) ? previewData[0] : previewData
  ) as InvitationPreview | null | undefined;
  const user = authResult.data.user;
  const returnPath = `/invitations/${encodeURIComponent(token)}`;

  if (!preview) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Invitación inválida</CardTitle>
            <CardDescription>
              El enlace no existe o ya no puede identificarse.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/">Volver al inicio</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const isPending = preview.invitation_status === "pending";
  const accountMatches =
    user?.email?.trim().toLowerCase() === preview.invited_email;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge variant="secondary">
              {getInvitationStatusLabel(preview.invitation_status)}
            </Badge>
            <Badge variant="outline">
              {getOrganizationRoleLabel(preview.invitation_role)}
            </Badge>
          </div>
          <CardTitle>Invitación a {preview.organization_name}</CardTitle>
          <CardDescription>
            Esta invitación fue emitida para {preview.invited_email} y expira el {formatDate(preview.invitation_expires_at)}.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {query.error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {query.error}
            </div>
          ) : null}

          {!isPending ? (
            <div className="rounded-md border bg-muted px-4 py-3 text-sm text-muted-foreground">
              Esta invitación ya fue aceptada, revocada o expiró. Solicita un enlace nuevo si todavía necesitas acceso.
            </div>
          ) : !user ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Inicia sesión o crea una cuenta usando exactamente el correo invitado.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button asChild>
                  <Link href={`/login?next=${encodeURIComponent(returnPath)}`}>
                    Iniciar sesión
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href={`/register?next=${encodeURIComponent(returnPath)}`}>
                    Crear cuenta
                  </Link>
                </Button>
              </div>
            </div>
          ) : !accountMatches ? (
            <div className="space-y-3">
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                Tu sesión usa {user.email}. Debes entrar con {preview.invited_email} para aceptar esta invitación.
              </div>
              <Button variant="outline" asChild>
                <Link href="/logout">Cambiar de cuenta</Link>
              </Button>
            </div>
          ) : (
            <form action={acceptOrganizationInvitationAction} className="space-y-3">
              <input type="hidden" name="token" value={token} />
              <p className="text-sm text-muted-foreground">
                Al aceptar, obtendrás acceso a los proyectos y recursos compartidos de la organización con el rol indicado.
              </p>
              <Button type="submit" className="w-full">
                Aceptar invitación
              </Button>
            </form>
          )}

          <div className="border-t pt-4 text-center text-sm">
            <Link href="/" className="text-muted-foreground underline">
              Volver al inicio
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
