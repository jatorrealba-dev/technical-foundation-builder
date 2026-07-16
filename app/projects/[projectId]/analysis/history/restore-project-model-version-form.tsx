"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

import { restoreProjectModelVersionFormAction } from "./actions";

type RestoreProjectModelVersionFormProps = {
  projectId: string;
  versionId: string;
  versionNumber: number;
};

function RestoreButton({
  versionNumber,
}: {
  versionNumber: number;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="outline"
      disabled={pending}
    >
      {pending
        ? "Restaurando..."
        : `Restaurar versión ${versionNumber}`}
    </Button>
  );
}

export function RestoreProjectModelVersionForm({
  projectId,
  versionId,
  versionNumber,
}: RestoreProjectModelVersionFormProps) {
  return (
    <form
      action={restoreProjectModelVersionFormAction}
      className="space-y-3 rounded-lg border border-amber-500/60 bg-amber-500/5 p-4"
    >
      <input
        type="hidden"
        name="projectId"
        value={projectId}
      />

      <input
        type="hidden"
        name="versionId"
        value={versionId}
      />

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          name="confirmRestore"
          required
          className="mt-1"
        />

        <span>
          Confirmo que esta versión reemplazará el Project Model
          vigente y regenerará los ocho documentos. El estado
          actual se conservará como una versión histórica.
        </span>
      </label>

      <RestoreButton
        versionNumber={versionNumber}
      />
    </form>
  );
}
