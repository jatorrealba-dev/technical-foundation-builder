import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const foundationOutputs = [
  "Product Spec",
  "MVP Scope",
  "Domain Model",
  "Architecture",
  "Data Model",
  "Security Baseline",
  "Backlog",
  "Vertical Slice Plan",
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Technical Foundation Builder
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              De la idea al paquete técnico listo para desarrollo.
            </h1>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" asChild>
              <Link href="/login">Iniciar sesión</Link>
            </Button>

            <Button asChild>
              <Link href="/register">Crear cuenta</Link>
            </Button>
          </div>
        </header>

        <div className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-8">
            <div className="space-y-5">
              <div className="inline-flex rounded-full border px-4 py-2 text-sm text-muted-foreground">
                SaaS para discovery, arquitectura y handoff técnico
              </div>

              <h2 className="max-w-3xl text-5xl font-bold tracking-tight">
                Convierte una idea desordenada en una base estructural para
                equipos de desarrollo y agentes de programación.
              </h2>

              <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
                La plataforma entrevista al usuario, detecta supuestos,
                organiza requisitos, define arquitectura, modela datos,
                identifica riesgos y genera documentos técnicos accionables.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" asChild>
                <Link href="/register">Crear primer proyecto</Link>
              </Button>

              <Button size="lg" variant="outline" asChild>
                <Link href="/login">Entrar al dashboard</Link>
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Paquete inicial generado</CardTitle>
              <CardDescription>
                El MVP comenzará generando los documentos esenciales para
                validar la propuesta principal.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                {foundationOutputs.map((output) => (
                  <div
                    key={output}
                    className="rounded-lg border bg-muted/30 px-4 py-3 text-sm font-medium"
                  >
                    {output}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
