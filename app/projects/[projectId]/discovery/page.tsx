import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { parseDiscoveryRuntimeContext } from "@/services/discovery/discovery-runtime-context";

import { DiscoveryClient } from "./discovery-client";

type PageProps = { params: Promise<{ projectId: string }> };

export default async function DiscoveryPage({ params }: PageProps) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError || !project) redirect("/dashboard");

  const { data, error } = await supabase.rpc("get_discovery_runtime_context", {
    target_project_id: projectId,
    target_message_limit: 30,
  });

  if (error) {
    throw new Error(`No se pudo cargar Discovery: ${error.message}`);
  }

  const context = parseDiscoveryRuntimeContext(data);

  return (
    <main className="min-h-screen bg-background">
      <section className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" asChild>
            <Link href={`/projects/${projectId}`}>← Volver al proyecto</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/projects/${projectId}/agents`}>Ver ejecuciones IA</Link>
          </Button>
        </div>

        <header className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight">{project.name}</h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Aclara tu visión en lenguaje natural. El sistema convierte cada respuesta
            en conocimiento trazable para producto, dominio, arquitectura, datos,
            seguridad y entrega.
          </p>
        </header>

        <DiscoveryClient
          projectId={projectId}
          initialMessages={context.messages}
          sessionStatus={context.session.status}
          coverageScore={context.session.current_coverage_score}
        />
      </section>
    </main>
  );
}
