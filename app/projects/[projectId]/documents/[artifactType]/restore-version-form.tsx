import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  isArtifactType,
} from "@/domain/artifacts/artifact-catalog";
import type {
  ArtifactType,
} from "@/domain/artifacts/artifact";

import {
  restoreArtifactVersionAction,
} from "./actions";

type RestoreVersionFormProps = {
  projectId: string;
  artifactType: ArtifactType;
  versionId: string;
  versionNumber: number;
};

async function restoreVersionFormAction(
  formData: FormData
) {
  "use server";

  const projectId = String(
    formData.get("projectId") ?? ""
  ).trim();

  const artifactTypeValue = String(
    formData.get("artifactType") ?? ""
  ).trim();

  const versionId = String(
    formData.get("versionId") ?? ""
  ).trim();

  if (!projectId) {
    redirect("/dashboard");
  }

  if (!isArtifactType(artifactTypeValue)) {
    redirect(
      `/projects/${projectId}/documents?error=${encodeURIComponent(
        "El tipo de documento seleccionado no es válido."
      )}`
    );
  }

  const historyPath =
    `/projects/${projectId}/documents/${artifactTypeValue}`;

  const result =
    await restoreArtifactVersionAction({
      projectId,
      artifactType: artifactTypeValue,
      versionId,
    });

  if (!result.ok) {
    redirect(
      `${historyPath}?error=${encodeURIComponent(
        result.error
      )}`
    );
  }

  redirect(
    `${historyPath}?restored=${result.restoredFromVersion}`
  );
}

export function RestoreVersionForm({
  projectId,
  artifactType,
  versionId,
  versionNumber,
}: RestoreVersionFormProps) {
  return (
    <form action={restoreVersionFormAction}>
      <input
        type="hidden"
        name="projectId"
        value={projectId}
      />

      <input
        type="hidden"
        name="artifactType"
        value={artifactType}
      />

      <input
        type="hidden"
        name="versionId"
        value={versionId}
      />

      <Button
        type="submit"
        variant="outline"
      >
        Restaurar versión {versionNumber}
      </Button>
    </form>
  );
}
