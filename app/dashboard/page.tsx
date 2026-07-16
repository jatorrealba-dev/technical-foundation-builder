import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getOrganizationRoleLabel } from "@/domain/organizations/collaboration";
import type { OrganizationRole } from "@/domain/organizations/membership";
import { createClient } from "@/lib/supabase/server";

type DashboardPageProps = {
  searchParams: Promise<{
    organizationId?: string;
    joined?: string;
    left?: string;
    error?: string;
  }>;
};

type OrganizationMembership = {
  organization_id: string;
  role: OrganizationRole;
  organizations:
    | {
        id: string;
        name: string;
        slug: string;
      }
    | {
        id: string;
        name: string;
        slug: string;
      }[]
    | null;
};

type ProjectRow = {
  id: string;
  name: string;
  description: string;
  industry: string;
  status: string;
  created_at: string;
};

function getOrganizationFromMembership(membership: OrganizationMembership) {
  if (Array.isArray(membership.organizations)) {
    return membership.organizations[0] ?? null;
  }

  return membership.organizations;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const query = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membershipsData, error: membershipsError } = await supabase
    .from("organization_members")
    .select(
      `
      organization_id,
      role,
      organizations (
        id,
        name,
        slug
      )
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (membershipsError) {
    throw new Error(membershipsError.message);
  }

  const memberships = (membershipsData ?? []) as unknown as OrganizationMembership[];

  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  const requestedMembership = query.organizationId
    ? memberships.find(
        (membership) => membership.organization_id === query.organizationId
      )
    : undefined;

  const membership = requestedMembership ?? memberships[0];
  const organization = getOrganizationFromMembership(membership);

  if (!organization) {
    redirect("/onboarding");
  }

  const { data: projects, error: projectsError } = await supabase
    .from("projects")
    .select("id, name, description, industry, status, created_at")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false });

  if (projectsError) {
    throw new Error(projectsError.message);
  }

  const projectRows = (projects ?? []) as ProjectRow[];

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-6xl px-6 py-10">
        <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{organization.name}</Badge>
              <Badge variant="outline">
                {getOrganizationRoleLabel(membership.role)}
              </Badge>
            </div>

            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>

            <p className="mt-2 max-w-2xl text-muted-foreground">
              Proyectos, equipo y gobernanza técnica de la organización activa.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" asChild>
              <Link href={`/organizations/${organization.id}/team`}>
                Administrar equipo
              </Link>
            </Button>

            <Button variant="outline" asChild>
              <Link href={`/organizations/${organization.id}/settings/ai`}>
                Operación de IA
              </Link>
            </Button>

            <Button variant="outline" asChild>
              <Link href="/logout">Cerrar sesión</Link>
            </Button>

            <Button asChild>
              <Link href={`/projects/new?organizationId=${organization.id}`}>
                Crear proyecto
              </Link>
            </Button>
          </div>
        </header>

        {query.error ? (
          <div className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {query.error}
          </div>
        ) : null}

        {query.joined === "1" ? (
          <div className="mb-6 rounded-md border bg-muted px-4 py-3 text-sm text-muted-foreground">
            Invitación aceptada. Ya tienes acceso a {organization.name}.
          </div>
        ) : null}

        {query.left === "1" ? (
          <div className="mb-6 rounded-md border bg-muted px-4 py-3 text-sm text-muted-foreground">
            Saliste de la organización correctamente.
          </div>
        ) : null}

        {memberships.length > 1 ? (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Organizaciones</CardTitle>
              <CardDescription>
                Cambia el espacio de trabajo activo sin cerrar sesión.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {memberships.map((item) => {
                const itemOrganization = getOrganizationFromMembership(item);

                if (!itemOrganization) {
                  return null;
                }

                const isActive = itemOrganization.id === organization.id;

                return (
                  <Button
                    key={item.organization_id}
                    variant={isActive ? "default" : "outline"}
                    asChild
                  >
                    <Link href={`/dashboard?organizationId=${itemOrganization.id}`}>
                      {itemOrganization.name} · {getOrganizationRoleLabel(item.role)}
                    </Link>
                  </Button>
                );
              })}
            </CardContent>
          </Card>
        ) : null}

        {projectRows.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No hay proyectos todavía</CardTitle>
              <CardDescription>
                Crea el primer proyecto de {organization.name} para iniciar la entrevista y el paquete técnico.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href={`/projects/new?organizationId=${organization.id}`}>
                  Crear primer proyecto
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {projectRows.map((project) => (
              <Card key={project.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle>{project.name}</CardTitle>
                      <CardDescription className="mt-2 line-clamp-2">
                        {project.description}
                      </CardDescription>
                    </div>

                    <Badge variant="secondary">{project.status}</Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid gap-2 text-sm text-muted-foreground">
                    <p>
                      <span className="font-medium text-foreground">
                        Industria:
                      </span>{" "}
                      {project.industry || "No definida"}
                    </p>
                    <p>
                      <span className="font-medium text-foreground">
                        Creado:
                      </span>{" "}
                      {formatDate(project.created_at)}
                    </p>
                  </div>

                  <Button variant="outline" asChild>
                    <Link href={`/projects/${project.id}`}>Abrir proyecto</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
