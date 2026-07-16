import Link from "next/link";

import { signUpAction } from "@/app/auth/actions";
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

type RegisterPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Crear cuenta</CardTitle>
          <CardDescription>
            Registra tu acceso para comenzar a crear paquetes técnicos.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form action={signUpAction} className="space-y-5">
            {params.next ? (
              <input type="hidden" name="next" value={params.next} />
            ) : null}
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="tu@email.com"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                minLength={8}
                required
              />
            </div>

            {params.error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {params.error}
              </div>
            ) : null}

            <Button type="submit" className="w-full">
              Crear cuenta
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <Link
              href={params.next ? `/login?next=${encodeURIComponent(params.next)}` : "/login"}
              className="font-medium text-foreground underline"
            >
              Iniciar sesión
            </Link>
          </div>

          <div className="mt-4 text-center text-sm">
            <Link href="/" className="text-muted-foreground underline">
              Volver al inicio
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
