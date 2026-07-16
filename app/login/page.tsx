import Link from "next/link";

import { signInAction } from "@/app/auth/actions";
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

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Iniciar sesión</CardTitle>
          <CardDescription>
            Entra a Technical Foundation Builder con tu cuenta.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form action={signInAction} className="space-y-5">
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
                placeholder="********"
                required
              />
            </div>

            {params.error ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {params.error}
              </div>
            ) : null}

            {params.message ? (
              <div className="rounded-md border bg-muted px-4 py-3 text-sm text-muted-foreground">
                {params.message}
              </div>
            ) : null}

            <Button type="submit" className="w-full">
              Entrar
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            ¿No tienes cuenta?{" "}
            <Link
              href={params.next ? `/register?next=${encodeURIComponent(params.next)}` : "/register"}
              className="font-medium text-foreground underline"
            >
              Crear cuenta
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
