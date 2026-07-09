import Link from "next/link";
import { redirect } from "next/navigation";

import { createOrganizationAction } from "@/app/onboarding/actions";
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

type OnboardingPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function OnboardingPage({
  searchParams,
}: OnboardingPageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  if (memberships && memberships.length > 0) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Configura tu organización</CardTitle>
          <CardDescription>
            Crea el espacio de trabajo donde vivirán tus proyectos,
            entrevistas, análisis y documentos técnicos.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form action={createOrganizationAction} className="space-y-5">
            <div className="grid gap-2">
              <Label htmlFor="organizationName">Nombre de la organización</Label>
              <Input
                id="organizationName"
                name="organizationName"
                placeholder="Ejemplo: JATA Studio"
                required
              />
            </div>

            {params.error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {params.error}
              </div>
            ) : null}

            <Button type="submit" className="w-full">
              Crear organización
            </Button>
          </form>

          <div className="mt-6 text-center text-sm">
            <Link href="/logout" className="text-muted-foreground underline">
              Cerrar sesión
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
