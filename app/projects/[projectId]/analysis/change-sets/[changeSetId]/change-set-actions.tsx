"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import {
  applyProjectModelChangeSetFormAction,
  closeProjectModelChangeSetFormAction,
} from "./actions";

function ApplyButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Aplicando cambios..." : "Aplicar cambios aceptados"}
    </Button>
  );
}

function CloseButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="destructive" disabled={pending}>
      {pending ? "Cerrando propuesta..." : "Cerrar sin aplicar"}
    </Button>
  );
}

export function ApplyChangeSetForm({
  projectId,
  changeSetId,
}: {
  projectId: string;
  changeSetId: string;
}) {
  return (
    <form
      action={applyProjectModelChangeSetFormAction}
      className="space-y-4 rounded-lg border border-green-600/50 bg-green-600/5 p-5"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="changeSetId" value={changeSetId} />

      <div>
        <p className="font-medium">Aplicación selectiva y transaccional</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Se aplicarán únicamente los cambios aceptados y se
          regenerarán solo los documentos afectados. El Project
          Model, sus versiones y los documentos se guardan como
          una sola operación.
        </p>
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="confirmApply"
          required
          className="mt-1"
        />
        <span>
          Confirmo que todos los cambios fueron revisados y
          autorizo la aplicación de los elementos aceptados.
        </span>
      </label>

      <ApplyButton />
    </form>
  );
}

export function CloseChangeSetForm({
  projectId,
  changeSetId,
}: {
  projectId: string;
  changeSetId: string;
}) {
  return (
    <form
      action={closeProjectModelChangeSetFormAction}
      className="space-y-4 rounded-lg border border-destructive/50 bg-destructive/5 p-5"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="changeSetId" value={changeSetId} />

      <div>
        <p className="font-medium">Todos los cambios fueron rechazados</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Cierra la propuesta sin modificar el Project Model ni
          regenerar documentos.
        </p>
      </div>

      <Textarea
        name="reason"
        maxLength={4000}
        className="min-h-20"
        placeholder="Motivo opcional para cerrar la propuesta."
      />

      <CloseButton />
    </form>
  );
}
