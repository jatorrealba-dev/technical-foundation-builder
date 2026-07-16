"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export function RunDeterministicReadinessButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending
        ? "Calculando readiness..."
        : "Ejecutar evaluación determinista"}
    </Button>
  );
}

export function ImportReadinessAgentButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="outline"
      disabled={pending}
    >
      {pending
        ? "Importando evaluación..."
        : "Importar evaluación aprobada"}
    </Button>
  );
}
