import Link from "next/link";
import { redirect } from "next/navigation";

import { createProjectAction } from "@/app/projects/actions";
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
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/server";

const productTypes = [
  { value: "saas", label: "SaaS" },
  { value: "web_app", label: "Aplicación web" },
  { value: "mobile_app", label: "Aplicación móvil" },
  { value: "internal_system", label: "Sistema interno" },
  { value: "marketplace", label: "Marketplace" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "ai_tool", label: "Herramienta con IA" },
  { value: "other", label: "Otro" },
];

const technicalLevels = [
  { value: "non_technical", label: "No técnico" },
  { value: "beginner", label: "Principiante" },
  { value: "intermediate", label: "Intermedio" },
  { value: "advanced", label: "Avanzado" },
];

type NewProjectPageProps = {
  searchParams: Promise<{
    error?: string;
    organizationId?: string;
  }>;
};

type MembershipRow = {
  organization_id: string;
  organizations:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
};

function getOrganization(membership: MembershipRow) {
  return Array.isArray(membership.organizations)
    ? membership.organizations[0] ?? null
    : membership.organizations;
}

export default async function NewProjectPage({
  searchParams,
}: NewProjectPageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membershipsData, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id, organizations(id, name)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  const memberships = (membershipsData ?? []) as unknown as MembershipRow[];

  if (memberships.length === 0) {
    redirect("/onboarding");
  }

  const membership =
    memberships.find(
      (item) => item.organization_id === params.organizationId
    ) ?? memberships[0];
  const organization = getOrganization(membership);

  if (!organization) {
    redirect("/onboarding");
  }

  const dashboardPath = `/dashboard?organizationId=${organization.id}`;

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-4xl px-6 py-10">
        <div className="mb-8">
          <Button variant="ghost" asChild>
            <Link href={dashboardPath}>← Volver al dashboard</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Crear nuevo proyecto</CardTitle>
            <CardDescription>
              Este proyecto se guardará en Supabase dentro de{" "}
              <span className="font-medium text-foreground">
                {organization.name}
              </span>
              .
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form action={createProjectAction} className="space-y-6">
              <input
                type="hidden"
                name="organizationId"
                value={organization.id}
              />

              <div className="grid gap-2">
                <Label htmlFor="name">Nombre del proyecto</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="Ejemplo: Technical Foundation Builder"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Describe tu idea</Label>
                <Textarea
                  id="description"
                  name="description"
                  placeholder="Explica qué quieres construir, para quién y qué problema resuelve."
                  className="min-h-36"
                  required
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="industry">Industria</Label>
                  <Input
                    id="industry"
                    name="industry"
                    placeholder="Ejemplo: software, salud, educación..."
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="productType">Tipo de producto</Label>
                  <select
                    id="productType"
                    name="productType"
                    defaultValue="saas"
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                  >
                    {productTypes.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="technicalLevel">
                    Nivel técnico del usuario
                  </Label>
                  <select
                    id="technicalLevel"
                    name="technicalLevel"
                    defaultValue="non_technical"
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                  >
                    {technicalLevels.map((level) => (
                      <option key={level.value} value={level.value}>
                        {level.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="mainGoal">Objetivo principal</Label>
                  <Input
                    id="mainGoal"
                    name="mainGoal"
                    placeholder="Ejemplo: preparar un paquete para desarrolladores"
                  />
                </div>
              </div>

              {params.error ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {params.error}
                </div>
              ) : null}

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" asChild>
                  <Link href={dashboardPath}>Cancelar</Link>
                </Button>

                <Button type="submit">Crear proyecto</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
