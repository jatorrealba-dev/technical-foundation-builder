"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { createLocalProject } from "@/lib/local-project-store";
import { ProductType, TechnicalLevel } from "@/domain/projects/project";
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

const productTypes: Array<{ value: ProductType; label: string }> = [
  { value: "saas", label: "SaaS" },
  { value: "web_app", label: "Aplicación web" },
  { value: "mobile_app", label: "Aplicación móvil" },
  { value: "internal_system", label: "Sistema interno" },
  { value: "marketplace", label: "Marketplace" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "ai_tool", label: "Herramienta con IA" },
  { value: "other", label: "Otro" },
];

const technicalLevels: Array<{ value: TechnicalLevel; label: string }> = [
  { value: "non_technical", label: "No técnico" },
  { value: "beginner", label: "Principiante" },
  { value: "intermediate", label: "Intermedio" },
  { value: "advanced", label: "Avanzado" },
];

export default function NewProjectPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [productType, setProductType] = useState<ProductType>("saas");
  const [technicalLevel, setTechnicalLevel] =
    useState<TechnicalLevel>("non_technical");
  const [mainGoal, setMainGoal] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("El nombre del proyecto es obligatorio.");
      return;
    }

    if (!description.trim()) {
      setError("La descripción de la idea es obligatoria.");
      return;
    }

    const project = createLocalProject({
      name,
      description,
      industry,
      productType,
      technicalLevel,
      mainGoal,
    });

    router.push(`/projects/${project.id}`);
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
              Describe la idea inicial. Luego la plataforma usará esta
              información para comenzar la entrevista técnica.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre del proyecto</Label>
                <Input
                  id="name"
                  placeholder="Ejemplo: Technical Foundation Builder"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">Describe tu idea</Label>
                <Textarea
                  id="description"
                  placeholder="Explica qué quieres construir, para quién y qué problema resuelve."
                  className="min-h-36"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="industry">Industria</Label>
                  <Input
                    id="industry"
                    placeholder="Ejemplo: software, salud, educación..."
                    value={industry}
                    onChange={(event) => setIndustry(event.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="productType">Tipo de producto</Label>
                  <select
                    id="productType"
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={productType}
                    onChange={(event) =>
                      setProductType(event.target.value as ProductType)
                    }
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
                    className="h-10 rounded-md border bg-background px-3 text-sm"
                    value={technicalLevel}
                    onChange={(event) =>
                      setTechnicalLevel(
                        event.target.value as TechnicalLevel
                      )
                    }
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
                    placeholder="Ejemplo: preparar un paquete para desarrolladores"
                    value={mainGoal}
                    onChange={(event) => setMainGoal(event.target.value)}
                  />
                </div>
              </div>

              {error ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
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
