"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export function RunDeterministicScanButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending
        ? "Analizando consistencia..."
        : "Ejecutar verificación determinista"}
    </Button>
  );
}

export function ImportAgentScanButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="outline" disabled={pending}>
      {pending
        ? "Importando hallazgos..."
        : "Importar hallazgos aprobados"}
    </Button>
  );
}
