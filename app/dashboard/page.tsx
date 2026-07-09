import Link from "next/link";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type OrganizationMembership = {
  role: string;
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

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: memberships, error: membershipsError } = await supabase
    .from("organization_members")
    .select(
      `
      role,
      organizations (
        id,
        name,
        slug
      )
    `
    )
    .eq("user_id", user.id)
    .limit(1);

  if (membershipsError) {
    throw new Error(membershipsError.message);
  }

  const membership = memberships?.[0] as OrganizationMembership | undefined;

  if (!membership) {
    redirect("/onboarding");
  }

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
        <header className="mb-10 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{organization.name}</Badge>
              <Badge variant="outline">{membership.role}</Badge>
            </div>

            <h1 className="text-3xl font-bold tracking-tight">
              Dashboard
            </h1>

            <p className="mt-2 max-w-2xl text-muted-foreground">
              Aquí se listarán los proyectos reales guardados en Supabase para
              esta organización.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" asChild>
              <Link href="/logout">Cerrar sesión</Link>
            </Button>

            <Button asChild>
              <Link href="/projects/new">Crear proyecto</Link>
            </Button>
          </div>
        </header>

        {projectRows.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No hay proyectos todavía</CardTitle>
              <CardDescription>
                Tu organización ya existe. El siguiente paso será guardar nuevos
                proyectos directamente en Supabase.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/projects/new">Crear primer proyecto</Link>
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
                    <Link href={`/projects/${project.id}`}>
                      Abrir proyecto
                    </Link>
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
