import Link from "next/link";
import { redirect } from "next/navigation";

import { createProjectAction } from "@/app/projects/actions";
import { createClient } from "@/lib/supabase/server";
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
  }>;
};

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

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw new Error(membershipError.message);
  }

  if (!membership) {
    redirect("/onboarding");
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", membership.organization_id)
    .maybeSingle();

  if (organizationError) {
    throw new Error(organizationError.message);
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-4xl px-6 py-10">
        <div className="mb-8">
          <Button variant="ghost" asChild>
            <Link href="/dashboard">← Volver al dashboard</Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Crear nuevo proyecto</CardTitle>
            <CardDescription>
              Este proyecto se guardará en Supabase dentro de{" "}
              <span className="font-medium text-foreground">
                {organization?.name ?? "tu organización"}
              </span>
              .
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form action={createProjectAction} className="space-y-6">
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
                  <Link href="/dashboard">Cancelar</Link>
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
